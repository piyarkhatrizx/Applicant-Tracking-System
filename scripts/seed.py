#!/usr/bin/env python3
"""
Generates the demo dataset in data/. Run: npm run seed
Self-check without writing anything: python3 scripts/seed.py --check
Report on data/ as it stands, without writing: python3 scripts/seed.py --report

Standard library only.

How the data is shaped
  Each applicant is simulated through the pipeline one stage at a time. At every
  stage they advance, are rejected, withdraw, or are still waiting there today.
  Stage gaps run from hours (resume review) to a week or more (interview to
  offer), recruiter work happens on weekday business hours, and a phone screen
  is a real connected call preceded by the voicemails and no-answers it took to
  reach someone. Every transition, call, note and archive writes an activity
  row, which is what analytics reads.

Reproducibility
  Every applicant draws from its own random stream, seeded from SEED and its
  index, and each pipeline is simulated on a fixed calendar before being
  shifted to the present by whole weeks, which preserves weekdays and hours.
  So statuses, sources, stage gaps, time to hire, calls and notes are
  identical on every run and every day. Only the placement against today moves
  with the clock, so the demo never looks stale; as a consequence which
  applicants are old enough to be archived, and which person reapplies to a
  second requisition, can shift slightly from one day to the next.

Encoding follows the conventions documented at the top of lib/store.ts.
"""

import csv
import json
import math
import os
import random
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median

# Found by searching for a seed whose pipeline meets every --check target with
# the rates below. Rates are never tuned to fit; change this only by searching again.
SEED = 20260959
APPLICANTS = 150
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

UTC = timezone.utc
DAY = timedelta(days=1)
WEEK = timedelta(days=7)
# A Monday. Pipelines are simulated here, then shifted to now by whole weeks.
BASE = datetime(2000, 1, 3, tzinfo=UTC)

# id, key, label, color token, is_terminal, counts_as
STATUSES = [
    ("1", "NEW", "New", "--status-open", False, "OPEN"),
    ("2", "SCREENING", "Screening", "--status-active", False, "OPEN"),
    ("3", "PHONE_SCREEN", "Phone screen", "--status-active", False, "OPEN"),
    ("4", "INTERVIEW", "Interview", "--status-active", False, "OPEN"),
    ("5", "OFFER", "Offer", "--status-accepted", False, "OPEN"),
    ("6", "HIRED", "Hired", "--status-accepted", True, "ACCEPTED"),
    ("7", "REJECTED", "Rejected", "--status-rejected", True, "REJECTED"),
    ("8", "WITHDRAWN", "Withdrawn", "--status-neutral", True, "REJECTED"),
]
STATUS_ID = {key: sid for sid, key, *_ in STATUSES}
STATUS_LABEL = {key: label for _, key, label, *_ in STATUSES}
TERMINAL = {key for _, key, _, _, terminal, _ in STATUSES if terminal}

# status is OPEN, PAUSED (paused three weeks ago) or CLOSED.
JOBS = [
    {"id": "1", "code": "CARE-001", "title": "Home Health Caregiver", "location": "Cleveland, OH", "employment_type": "FULL_TIME", "status": "OPEN", "opened_days_ago": 128, "weight": 0.26,
     "description": "Visit clients in their homes to help with daily living, meals, medication reminders and companionship."},
    {"id": "2", "code": "CARE-002", "title": "Overnight Care Specialist", "location": "Lakewood, OH", "employment_type": "PART_TIME", "status": "OPEN", "opened_days_ago": 112, "weight": 0.18,
     "description": "Overnight shifts supporting clients who need safety checks, repositioning and help at night."},
    {"id": "3", "code": "CARE-003", "title": "Live-In Caregiver", "location": "Shaker Heights, OH", "employment_type": "FULL_TIME", "status": "OPEN", "opened_days_ago": 104, "weight": 0.12,
     "description": "Round-the-clock support for one client, with a private room and scheduled days off."},
    {"id": "4", "code": "CARE-004", "title": "Certified Nursing Assistant", "location": "Parma, OH", "employment_type": "FULL_TIME", "status": "OPEN", "opened_days_ago": 46, "weight": 0.18,
     "description": "State-tested nursing assistants for personal care, vital signs and mobility support under nurse supervision."},
    {"id": "5", "code": "CARE-005", "title": "Respite Care Aide", "location": "Euclid, OH", "employment_type": "PART_TIME", "status": "PAUSED", "opened_days_ago": 120, "weight": 0.12,
     "description": "Short stays that give family caregivers a break, from a few hours to a full weekend."},
    {"id": "6", "code": "CARE-006", "title": "Weekend Companion Caregiver", "location": "Westlake, OH", "employment_type": "PART_TIME", "status": "CLOSED", "opened_days_ago": 160, "weight": 0.10,
     "description": "Weekend companionship, light housekeeping and errands for clients who live independently."},
]

SOURCES = [("APPLY_FORM", 0.40), ("EMAIL", 0.30), ("REFERRAL", 0.15), ("MANUAL", 0.15)]

# Per stage: advance, reject, withdraw, or still sitting in that stage today.
# Believable for a caregiver agency; volume, not these rates, is what gets the
# absolute counts high enough. See TARGETS for the shape --check enforces.
STAGE_ODDS = {
    "NEW": [("adv", 0.50), ("rej", 0.35), ("wd", 0.02), ("stall", 0.13)],
    "SCREENING": [("adv", 0.50), ("rej", 0.16), ("wd", 0.06), ("stall", 0.28)],
    "PHONE_SCREEN": [("adv", 0.58), ("rej", 0.20), ("wd", 0.07), ("stall", 0.15)],
    "INTERVIEW": [("adv", 0.60), ("rej", 0.18), ("wd", 0.07), ("stall", 0.15)],
    "OFFER": [("adv", 0.75), ("wd", 0.10), ("stall", 0.15)],
}

# name, low, high. Rejected overall counts everything whose status counts as
# REJECTED, so withdrawals are included.
TARGETS = [
    ("rejected overall", 0.55, 0.65),
    ("cleared initial screening", 0.40, 0.50),
    ("call connect rate", 0.30, 0.40),
]
HIRES = (8, 12)
# Days from applying to the first move into an accepted status.
TIME_TO_HIRE_MEDIAN = (12.5, 16)
TIME_TO_HIRE_FLOOR = 4
FAST_HIRES = (6, 10, 2)  # at least 2 hires land between 6 and 10 days
# Gap multiplier for referrals and every FAST_EVERY-th applicant. Timing only.
FAST_PACE = 0.35
FAST_EVERY = 4

RECRUITERS = ["Dana Whitfield", "Luis Ortega"]

FIRST = [
    "Aisha", "Maria", "Tamika", "Jennifer", "DeShawn", "Olga", "Rosa", "Keisha", "Priya", "Fatima",
    "Linda", "Carmen", "Tanisha", "Mei", "Grace", "Yolanda", "Angela", "Darnell", "Brianna", "Svetlana",
    "Nadia", "Jasmine", "Monique", "Luz", "Patricia", "Ebony", "Hannah", "Ifeoma", "Latoya", "Samantha",
    "Beatriz", "Kimberly", "Tiffany", "Amina", "Crystal", "Destiny", "Elena", "Gloria", "Hye-jin", "Imani",
    "Jolene", "Khadija", "Lakisha", "Marisol", "Nicole", "Oksana", "Precious", "Quiana", "Renee", "Shanice",
    "Teresa", "Valerie", "Whitney", "Ximena", "Yasmin", "Zainab", "Marcus", "Andre", "Luis", "Kevin",
    "Jamal", "Dmitri",
]
LAST = [
    "Johnson", "Okonkwo", "Rodriguez", "Washington", "Nguyen", "Kowalski", "Patel", "Hernandez", "Brooks", "Abara",
    "Petrova", "Williams", "Jackson", "Lopez", "Kim", "Robinson", "Mensah", "Sullivan", "Ramirez", "Carter",
    "Hassan", "Novak", "Mitchell", "Delgado", "Harris", "Adeyemi", "Coleman", "Ortiz", "Bennett", "Yilmaz",
    "Price", "Moreno", "Hughes", "Diallo", "Foster", "Reyes", "Simmons", "Kaur", "Bryant", "Castillo",
    "Jenkins", "Popescu", "Gray", "Torres", "Wallace", "Nwosu", "Ford", "Silva", "Henderson", "Mahmoud",
    "Russell", "Vargas", "Griffin", "Chen", "Hayes", "Morales", "Myers", "Tran", "O'Neill", "Fernández",
    "Stewart", "Bui",
]
LOCATIONS = [
    "Cleveland, OH", "Lakewood, OH", "Parma, OH", "Euclid, OH", "Shaker Heights, OH", "Cleveland Heights, OH",
    "Westlake, OH", "Strongsville, OH", "Garfield Heights, OH", "North Olmsted, OH", "Mentor, OH", "Elyria, OH",
]
TITLES = [
    "Home Health Aide", "STNA", "Caregiver", "Personal Care Aide", "Companion Caregiver", "CNA",
    "Hospice Aide", "Direct Support Professional", "Medical Assistant", "Nursing Student", "", "",
]
EMPLOYERS = [
    "Riverside Senior Living", "Bright Path Home Care", "Harbor Light Homes", "Summit Care Group",
    "Willow Creek Residences", "Northcoast Private Duty", "Evergreen Home Health",
    "Lakeshore Assisted Living", "Self-employed, private clients", "",
]
# The 555-0100 to 555-0199 block is reserved for fiction.
PHONES = [f"{area}555{n:04d}" for area in ("216", "440", "330", "234") for n in range(100, 200)]

# ---- Words ----------------------------------------------------------------

REVIEW = [
    "Resume shows three years of home care. Worth a call.",
    "Dementia care experience at a memory care unit.",
    "Short gaps between roles; ask about availability on the call.",
    "STNA listed on the resume; verify on the phone screen.",
]
REJECT_REVIEW = [
    "No caregiving or personal care experience listed.",
    "Applied for an office role; this posting is in-home care.",
    "Outside the service area with no plans to relocate.",
]
UNDER_18 = ["Indicated they are under 18. Not eligible for in-home care roles."]
NO_PHONE = ["No phone number on file and no reply to two emails."]
UNREACHABLE = ["No response after four call attempts."]
WITHDRAW = [
    "Accepted a position closer to home.",
    "Staying with their current agency after a raise.",
    "Schedule no longer works with childcare.",
    "Going back to school full time this semester.",
]
PHONE_PASS = [
    "Available weekdays 7a to 3p. Has own car and a clean driving record.",
    "Comfortable with Hoyer lifts and transfers. Prefers west side clients.",
    "Bilingual English and Spanish, which helps with two current clients.",
    "Wants 30+ hours a week. Can start in two weeks.",
    "Strong answers on medication reminders and shift notes.",
]
REJECT_PHONE = [
    "Needs a pay rate above the range for this role.",
    "Cannot cover any of the open shifts.",
    "No reliable transportation for the service area.",
]
INTERVIEW_BOOKED = [
    "In-person interview booked at the office.",
    "Interview set; asked them to bring their certifications.",
]
REJECT_LATE = [
    "References did not come back.",
    "Did not complete the background check paperwork.",
    "Stopped responding after the phone screen.",
]
INTERVIEW_GOOD = [
    "Great rapport in the interview. References came back positive.",
    "Shadow shift with a senior caregiver went well.",
    "Client's family met them and asked to move forward.",
]
REJECT_INTERVIEW = [
    "Did not show for the scheduled interview.",
    "Solid interview, but another candidate was a better fit for the overnight schedule.",
    "Transfer skills check did not meet the bar for this client.",
]
HIRED = [
    "Start date confirmed. Orientation packet sent.",
    "Signed offer. TB test and paperwork scheduled.",
    "Hired. Paired with a senior caregiver for the first two shifts.",
]
DECLINE = [
    "Declined the offer; took a role with a shorter commute.",
    "Declined over pay rate. Open to future roles.",
]
PINNED = [
    "Only available weekends. Check before scheduling.",
    "Prefers text over calls.",
    "Worked with us in 2024 and is eligible for rehire.",
    "Needs shifts that end by 3pm for school pickup.",
]

# Seconds, by call context or outcome.
DURATIONS = {
    "screen_pass": (360, 1100), "screen_fail": (180, 600), "schedule": (90, 240),
    "offer": (240, 600), "decline": (120, 400),
    "VOICEMAIL": (25, 55), "NO_ANSWER": (18, 35), "CALLBACK_REQUESTED": (30, 90), "WRONG_NUMBER": (15, 45),
}
CALL_NOTES = {
    "screen_pass": [
        "Good call. Two years with a private-duty client and wants more hours.",
        "Walked through a typical shift. Comfortable with transfers and bathing.",
        "Available immediately. Asked about mileage reimbursement.",
        "Warm, clear communicator. Moving forward.",
    ],
    "screen_fail": [
        "Looking for a clinical role; this is non-medical care.",
        "Needs a schedule we cannot offer right now.",
        "Not comfortable with overnight or live-in shifts.",
    ],
    "schedule": ["Booked the in-person interview.", "Confirmed the interview time and sent the address.", ""],
    "offer": [
        "Extended a verbal offer. Written offer going out by email.",
        "Offer call. Asked for a day to think it over.",
        "Went over pay, schedule and start date.",
    ],
    "decline": ["Called to decline; took another role.", "Declined over pay rate."],
    "VOICEMAIL": ["Left voicemail with callback number.", "Left voicemail.", ""],
    "NO_ANSWER": ["", "", "Rang out, no voicemail set up."],
    "CALLBACK_REQUESTED": ["At work, asked for a call back after 5pm.", "Driving, asked to be called tomorrow morning."],
    "WRONG_NUMBER": ["Number belongs to someone else. Emailed to confirm the right number."],
}
FAIL_OUTCOMES = [("NO_ANSWER", 0.44), ("VOICEMAIL", 0.38), ("CALLBACK_REQUESTED", 0.14), ("WRONG_NUMBER", 0.04)]

DISPOSITION_LABEL = {
    "CONNECTED": "Reached", "VOICEMAIL": "Left voicemail", "NO_ANSWER": "No answer",
    "WRONG_NUMBER": "Wrong number", "CALLBACK_REQUESTED": "Callback requested",
}
NEXT_STEP = {
    "CONNECTED": "Update the applicant's stage to match the conversation.",
    "VOICEMAIL": "Try again tomorrow if there is no callback.",
    "NO_ANSWER": "Try again at a different time of day.",
    "CALLBACK_REQUESTED": "Call back at the time requested.",
    "WRONG_NUMBER": "Confirm the number by email before calling again.",
}


def weighted(r, pairs):
    x, acc = r.random(), 0.0
    for value, weight in pairs:
        acc += weight
        if x < acc:
            return value
    return pairs[-1][0]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def parse_iso(text):
    # The seed writes .000Z; the app writes real milliseconds. --report reads both.
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)


def flag(value):
    return "" if value is None else ("true" if value else "false")


def format_phone(digits):
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def format_duration(seconds):
    minutes, rest = divmod(seconds, 60)
    return f"{minutes}m {rest:02d}s" if minutes else f"{rest}s"


def call_summary(name, phone, direction, disposition, seconds, notes):
    # lib/calls/summary.ts writes the same words for live calls, and
    # test/calls/summary.test.ts regenerates every seeded summary to keep them in step.
    lead = "Outbound call to" if direction == "OUTBOUND" else "Inbound call from"
    lines = [
        f"{lead} {name}, {format_phone(phone)}.",
        f"Outcome: {DISPOSITION_LABEL[disposition]}. Duration: {format_duration(seconds)}.",
    ]
    if notes:
        lines.append(f"Notes: {notes}")
    lines.append(f"Next step: {NEXT_STEP[disposition]}")
    return "\n".join(lines)


# ---- Simulation -----------------------------------------------------------

class Applicant:
    def __init__(self, index):
        self.index = index
        self.r = random.Random(f"{SEED}-applicant-{index}")
        self.events = []
        self.stage = "NEW"
        # Multiplies every recruiter gap. Set from the source and index, never
        # from a random draw, so it changes timing and nothing else.
        self.pace = 1.0

    def pick(self, pool):
        return pool[self.r.randrange(len(pool))]

    def add(self, at, kind, **data):
        self.events.append({"at": at, "kind": kind, **data})

    def later(self, at, low, high):
        return at + timedelta(minutes=self.r.randint(low, high))

    def work_time(self, prev, gap_days):
        """A recruiter action gap_days after prev, on a weekday between 9am and 5pm Eastern."""
        day = prev + timedelta(days=gap_days * self.pace)
        at = datetime(day.year, day.month, day.day, tzinfo=UTC) + timedelta(minutes=13 * 60 + self.r.randrange(8 * 60))
        if at.weekday() >= 5:
            at += timedelta(days=7 - at.weekday())
        # Drawn every time, used or not. A draw that happened only on short gaps
        # would let timing (pace) shift the random stream and change outcomes.
        jitter = self.r.randrange(50)
        if at < prev + timedelta(minutes=10):
            at = prev + timedelta(minutes=10 + jitter)
        return at

    def call(self, start, disposition, direction, context=None):
        low, high = DURATIONS[context or disposition]
        seconds = self.r.randint(low, high)
        self.add(start, "call", disposition=disposition, direction=direction, seconds=seconds,
                 notes=self.pick(CALL_NOTES[context or disposition]))
        return start + timedelta(seconds=seconds)

    def miss(self, at, count):
        """count unanswered attempts starting at `at`; returns when the next try happens."""
        for _ in range(count):
            at = self.work_time(self.call(at, weighted(self.r, FAIL_OUTCOMES), "OUTBOUND"), self.r.uniform(0.3, 1.2))
        return at

    def move(self, at, key, pool=(), chance=0.0):
        self.add(at, "status", to=key)
        self.stage = key
        if pool and self.r.random() < chance:
            self.add(self.later(at, 1, 6), "note", body=self.pick(pool), pinned=False)


def simulate(index):
    a = Applicant(index)
    r = a.r
    a.source = weighted(r, SOURCES)
    # Referrals, and a slice of urgent fills, move through the pipeline faster,
    # so some hires land in about a week.
    a.pace = FAST_PACE if a.source == "REFERRAL" or index % FAST_EVERY == 0 else 1.0
    no_phone, under_18, cpa, medicare, interest = (r.random() for _ in range(5))
    a.has_phone = not (a.source in ("EMAIL", "MANUAL") and no_phone < 0.18)
    a.screening = None
    under_18 = a.source == "APPLY_FORM" and under_18 < 0.06
    if a.source == "APPLY_FORM":
        a.screening = {
            "is_at_least_18": not under_18,
            "is_cpa_certified": None if cpa < 0.25 else cpa < 0.6,
            "patient_uses_medicare": medicare < 0.45,
            "caregiving_interest": "CURRENTLY_CARING_FOR_PATIENT" if interest < 0.3 else "GENERAL_CAREGIVER",
        }
    a.recruiter = RECRUITERS[r.randrange(len(RECRUITERS))]

    run_pipeline(a, under_18)

    # Drawn after the pipeline and used only at placement, so nothing that
    # depends on today's date can change how many numbers the pipeline drew.
    a.target_roll = r.random()
    a.new_roll = r.uniform(0.05, 9.0)
    a.archive_rolls = (r.random(), r.uniform(7, 14), r.random(), r.uniform(2, 6))
    return a


def run_pipeline(a, under_18):
    r = a.r
    applied = BASE + timedelta(days=r.randrange(7), minutes=11 * 60 + r.randrange(14 * 60))
    a.add(applied, "created")

    # NEW: a recruiter reviews the application.
    outcome = "rej" if under_18 else weighted(r, STAGE_ODDS["NEW"])
    if outcome == "stall":
        return
    if r.random() < 0.1:
        a.add(a.work_time(applied, r.uniform(0.05, 0.8)), "note", body=a.pick(PINNED), pinned=True)
    t = a.work_time(applied, r.uniform(0.15, 2.5))
    if outcome == "adv":
        a.move(t, "SCREENING", REVIEW, 0.3)
    else:
        pool = UNDER_18 if under_18 else (REJECT_REVIEW if outcome == "rej" else WITHDRAW)
        return a.move(t, "REJECTED" if outcome == "rej" else "WITHDRAWN", pool, 1.0 if under_18 else 0.65)

    # SCREENING: reach them by phone. The connected call is the phone screen.
    outcome = weighted(r, STAGE_ODDS["SCREENING"])
    if not a.has_phone:
        if outcome == "stall":
            return
        outcome = "wd" if outcome == "wd" else "rej"
        t = a.work_time(t, r.uniform(3, 6))
        return a.move(t, "REJECTED" if outcome == "rej" else "WITHDRAWN", NO_PHONE if outcome == "rej" else WITHDRAW,
                      1.0 if outcome == "rej" else 0.6)

    unreachable = outcome == "rej" and r.random() < 0.45
    attempts = 4 if unreachable else weighted(r, [(0, 0.15), (1, 0.30), (2, 0.30), (3, 0.25)])
    last_miss = None
    for attempt in range(attempts):
        wrong = unreachable and attempt == attempts - 1 and r.random() < 0.35
        disposition = "WRONG_NUMBER" if wrong else weighted(r, FAIL_OUTCOMES)
        gap = r.uniform(0.05, 1.0) if attempt == 0 else r.uniform(0.4, 1.6)
        t = a.call(a.work_time(t, gap), disposition, "OUTBOUND")
        last_miss = disposition
    if outcome == "stall":
        return
    if unreachable:
        return a.move(a.work_time(t, r.uniform(1, 3)), "REJECTED", UNREACHABLE, 1.0)

    direction = "INBOUND" if last_miss in ("VOICEMAIL", "CALLBACK_REQUESTED") and r.random() < 0.35 else "OUTBOUND"
    gap = r.uniform(0.05, 1.0) if attempts == 0 else r.uniform(0.3, 1.2)
    t = a.later(a.call(a.work_time(t, gap), "CONNECTED", direction, "screen_pass" if outcome == "adv" else "screen_fail"), 2, 12)
    if outcome == "adv":
        a.move(t, "PHONE_SCREEN", PHONE_PASS, 0.5)
    else:
        return a.move(t, "REJECTED" if outcome == "rej" else "WITHDRAWN", REJECT_PHONE if outcome == "rej" else WITHDRAW, 0.6)

    # PHONE_SCREEN: book the interview.
    outcome = weighted(r, STAGE_ODDS["PHONE_SCREEN"])
    if outcome == "stall":
        return
    t = a.work_time(t, r.uniform(0.75, 6))
    if outcome == "adv":
        t = a.miss(t, weighted(r, [(0, 0.5), (1, 0.4), (2, 0.1)]))
        a.move(a.later(a.call(t, "CONNECTED", "OUTBOUND", "schedule"), 2, 10), "INTERVIEW", INTERVIEW_BOOKED, 0.25)
    else:
        return a.move(t, "REJECTED" if outcome == "rej" else "WITHDRAWN", REJECT_LATE if outcome == "rej" else WITHDRAW, 0.6)

    # INTERVIEW: decide, then call with the offer.
    outcome = weighted(r, STAGE_ODDS["INTERVIEW"])
    if outcome == "stall":
        return
    t = a.work_time(t, r.uniform(1.5, 8))
    if outcome == "adv":
        if r.random() < 0.6:
            a.add(t, "note", body=a.pick(INTERVIEW_GOOD), pinned=False)
        offer_at = a.miss(a.later(t, 20, 90), weighted(r, [(0, 0.6), (1, 0.4)]))
        a.move(a.later(a.call(offer_at, "CONNECTED", "OUTBOUND", "offer"), 2, 10), "OFFER")
    else:
        return a.move(t, "REJECTED" if outcome == "rej" else "WITHDRAWN", REJECT_INTERVIEW if outcome == "rej" else WITHDRAW, 0.7)

    # OFFER: accept or decline.
    outcome = weighted(r, STAGE_ODDS["OFFER"])
    if outcome == "stall":
        return
    t = a.work_time(t, r.uniform(0.75, 5))
    if outcome == "adv":
        a.move(t, "HIRED", HIRED, 0.75)
    else:
        direction = "INBOUND" if r.random() < 0.5 else "OUTBOUND"
        a.move(a.later(a.call(t, "CONNECTED", direction, "decline"), 2, 10), "WITHDRAWN", DECLINE, 0.8)


def place(a, now):
    """Shift the simulated timeline to the present."""
    applied = a.events[0]["at"]
    last = max(event["at"] for event in a.events)
    if a.stage == "NEW":
        # Untouched new applications carry no recruiter work, so they can land
        # at any hour of the last nine days rather than on a whole-week shift.
        delta = now - timedelta(days=a.new_roll) - applied
    elif a.stage in TERMINAL:
        span = (last - applied) / DAY
        # Volume ramps up toward today without emptying the start of the
        # window: density falls linearly to 60% of its peak at 88 days back.
        # This is the inverse CDF of f(x) proportional to 1 - 0.4x on [0, 1].
        ramp = (1 - math.sqrt(1 - 0.64 * a.target_roll)) / 0.4
        target = span + 3 + (85 - span) * ramp
        weeks = round((now - timedelta(days=target) - applied) / WEEK)
        while last + weeks * WEEK > now:
            weeks -= 1
        # Rounding to whole weeks must not push anyone out of the 90-day window.
        while applied + weeks * WEEK < now - 89 * DAY:
            weeks += 1
        delta = weeks * WEEK
    else:
        # Still in progress: the latest step happened within the last two weeks.
        # new_roll is unused on this branch, so it doubles as the extra lag.
        lag = timedelta(days=a.new_roll * 7 / 9)
        delta = math.floor((now - lag - last) / WEEK) * WEEK
    for event in a.events:
        event["at"] += delta


def archive(a, now):
    a.archived_at = None
    roll, gap, restore_roll, restore_gap = a.archive_rolls
    if a.stage not in TERMINAL or roll >= 0.45:
        return
    last = max(event["at"] for event in a.events)
    day = last + timedelta(days=int(gap))
    at = datetime(day.year, day.month, day.day, tzinfo=UTC) + timedelta(minutes=13 * 60 + int((gap % 1) * 480))
    if last > now - 21 * DAY or at > now:
        return
    a.add(at, "archived")
    a.archived_at = at
    back = at + timedelta(days=restore_gap)
    if restore_roll < 0.12 and back <= now:
        a.add(back, "restored")
        a.archived_at = None


def assign_jobs(applicants, now):
    for a in applicants:
        roll = random.Random(f"{SEED}-job-{a.index}").random()
        applied = a.events[0]["at"]
        eligible = [
            job for job in JOBS
            if now - timedelta(days=job["opened_days_ago"]) <= applied - DAY
            and (job["status"] == "OPEN"
                 # Paused three weeks ago: nothing newer lands on it.
                 or (job["status"] == "PAUSED" and applied <= now - 21 * DAY)
                 # Closed: only finished applications, and only old ones.
                 or (a.stage in TERMINAL and applied <= now - 40 * DAY))
        ]
        x = roll * sum(job["weight"] for job in eligible)
        for job in eligible:
            x -= job["weight"]
            if x < 0:
                break
        a.job = job


def slug(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower() if c.isalpha())


def assign_people(applicants):
    r = random.Random(f"{SEED}-people")
    # Unique full names; first names repeat across people, as they do in life.
    names = r.sample([(first, last) for first in FIRST for last in LAST], len(applicants))
    phones = r.sample(PHONES, len(applicants))
    emails = set()
    for a, (first, last), phone in zip(applicants, names, phones):
        f, l = slug(first), slug(last)
        pattern, number = r.randrange(3), r.randrange(10, 99)
        email = [f"{f}.{l}@example.com", f"{f}{l}{number}@example.net", f"{f[0]}{l}@example.org"][pattern]
        while email in emails:
            number += 1
            email = f"{f}.{l}{number}@example.com"
        emails.add(email)
        sparse = a.source in ("EMAIL", "MANUAL") and r.random() < 0.2
        location, title, employer = r.choice(LOCATIONS), r.choice(TITLES), r.choice(EMPLOYERS)
        # A demo- prefix and a random suffix, so no seeded slug points at a real profile.
        has_linkedin, suffix = r.random() < 0.4, r.randrange(1000, 10000)
        a.person = {
            "first_name": first,
            "last_name": last,
            "email": email,
            "phone": phone if a.has_phone else "",
            "location": "" if sparse else location,
            "current_title": title,
            "current_employer": employer if title else "",
            "linkedin_url": f"https://www.linkedin.com/in/demo-{f}-{l}-{suffix}" if has_linkedin else "",
        }


def reuse_people(applicants):
    """A few people apply to a second requisition, so dedupe has work to do."""
    ordered = sorted(applicants, key=lambda a: (a.events[0]["at"], a.index))
    targets = {a.index for a in applicants if a.index % 15 == 7}
    donated = set()
    for a in ordered:
        if a.index not in targets or not a.has_phone:
            continue
        donors = [
            d for d in ordered
            if d.index not in targets and d.index not in donated and d.has_phone
            and d.job["id"] != a.job["id"] and d.events[0]["at"] <= a.events[0]["at"] - 3 * DAY
        ]
        if donors:
            donated.add(donors[-1].index)
            a.person = dict(donors[-1].person)


def build(now):
    applicants = [simulate(i) for i in range(APPLICANTS)]
    for a in applicants:
        place(a, now)
        archive(a, now)
    assign_jobs(applicants, now)
    assign_people(applicants)
    reuse_people(applicants)
    return assemble(applicants, now)


def assemble(applicants, now):
    ordered = sorted(applicants, key=lambda a: (a.events[0]["at"], a.index))
    timeline = []
    for number, a in enumerate(ordered, 1):
        a.id = str(number)
        for seq, event in enumerate(sorted(a.events, key=lambda e: e["at"])):
            timeline.append((event["at"], number, seq, a, event))
    timeline.sort(key=lambda item: item[:3])

    notes, calls, activity = [], [], []
    stage = {a.id: "NEW" for a in ordered}
    for at, _, _, a, event in timeline:
        kind = event["kind"]
        actor = a.recruiter
        if kind == "created":
            entry, detail, actor = "APPLICATION_CREATED", {"source": a.source}, ""
        elif kind == "status":
            before, after = stage[a.id], event["to"]
            stage[a.id] = after
            entry = "STATUS_CHANGED"
            detail = {"from": STATUS_LABEL[before], "to": STATUS_LABEL[after],
                      "fromStatusId": STATUS_ID[before], "toStatusId": STATUS_ID[after]}
        elif kind == "note":
            notes.append([str(len(notes) + 1), a.id, event["body"], flag(event["pinned"]), iso(at)])
            entry, detail = "NOTE_ADDED", {"noteId": notes[-1][0]}
        elif kind == "call":
            name = f"{a.person['first_name']} {a.person['last_name']}"
            calls.append([
                str(len(calls) + 1), a.id, event["direction"], event["disposition"], str(event["seconds"]),
                a.person["phone"], event["notes"],
                call_summary(name, a.person["phone"], event["direction"], event["disposition"], event["seconds"], event["notes"]),
                iso(at), iso(at + timedelta(seconds=event["seconds"])),
            ])
            entry, detail = "CALL_LOGGED", {"callLogId": calls[-1][0]}
        else:
            entry, detail = kind.upper(), {}
        activity.append([str(len(activity) + 1), a.id, entry, json.dumps(detail, separators=(",", ":")), actor, iso(at)])

    screening = lambda a, key: flag(a.screening[key]) if a.screening else ""
    return {
        "jobs": (
            ["id", "code", "title", "location", "description", "employment_type", "status", "opened_at"],
            [[j["id"], j["code"], j["title"], j["location"], j["description"], j["employment_type"], j["status"],
              iso(datetime.combine((now - timedelta(days=j["opened_days_ago"])).date(), datetime.min.time(), UTC) + timedelta(hours=14))]
             for j in JOBS],
        ),
        "statuses": (
            ["id", "key", "label", "color", "sort_order", "is_terminal", "active", "counts_as"],
            [[sid, key, label, color, str(order), flag(terminal), "true", counts]
             for order, (sid, key, label, color, terminal, counts) in enumerate(STATUSES)],
        ),
        "applicants": (
            ["id", "job_id", "first_name", "last_name", "email", "phone", "location", "current_title",
             "current_employer", "linkedin_url", "source", "status_id", "is_at_least_18", "is_cpa_certified",
             "patient_uses_medicare", "caregiving_interest", "applied_at", "updated_at", "archived_at"],
            [[a.id, a.job["id"], *a.person.values(), a.source, STATUS_ID[a.stage],
              screening(a, "is_at_least_18"), screening(a, "is_cpa_certified"), screening(a, "patient_uses_medicare"),
              a.screening["caregiving_interest"] if a.screening else "",
              iso(a.events[0]["at"]), iso(max(e["at"] for e in a.events)), iso(a.archived_at) if a.archived_at else ""]
             for a in ordered],
        ),
        "notes": (["id", "applicant_id", "body", "pinned", "created_at"], notes),
        "call_logs": (
            ["id", "applicant_id", "direction", "disposition", "duration_seconds", "phone_number", "notes",
             "summary", "started_at", "ended_at"],
            calls,
        ),
        "activity": (["id", "applicant_id", "type", "detail_json", "actor", "created_at"], activity),
        # Recruiter-configured apply-page fields. Empty at seed time; populated
        # through the "Create new job board" flow (app/actions/jobs.ts).
        "job_fields": (["id", "job_id", "key", "label", "type", "options", "required", "order_index"], []),
        "application_field_values": (["id", "application_id", "job_field_id", "value"], []),
    }


# ---- Checks ---------------------------------------------------------------

def shape(rows):
    applicants = rows["applicants"]
    statuses = {s["id"]: s for s in rows["statuses"]}
    rejected = sum(statuses[a["status_id"]]["counts_as"] == "REJECTED" for a in applicants)
    screened = {
        r["applicant_id"] for r in rows["activity"]
        if r["type"] == "STATUS_CHANGED" and json.loads(r["detail_json"])["toStatusId"] == STATUS_ID["SCREENING"]
    }
    connected = sum(c["disposition"] == "CONNECTED" for c in rows["call_logs"])
    values = (rejected / len(applicants), len(screened) / len(applicants), connected / len(rows["call_logs"]))
    return [(name, value, low, high) for (name, low, high), value in zip(TARGETS, values)]


def time_to_hire(rows):
    """Days from applying to the first move into an accepted status, per hire. Same rule as lib/analytics.ts."""
    counts_as = {s["id"]: s["counts_as"] for s in rows["statuses"]}
    applied = {a["id"]: parse_iso(a["applied_at"]) for a in rows["applicants"]}
    hired_at = {}
    for r in sorted(rows["activity"], key=lambda r: (r["created_at"], int(r["id"]))):
        if r["type"] == "STATUS_CHANGED" and counts_as.get(json.loads(r["detail_json"])["toStatusId"]) == "ACCEPTED":
            hired_at.setdefault(r["applicant_id"], parse_iso(r["created_at"]))
    return [(at - applied[a]) / DAY for a, at in hired_at.items()]


def check(condition, message):
    if not condition:
        raise SystemExit(f"seed check failed: {message}")


def validate(tables, now):
    rows = {name: [dict(zip(columns, row)) for row in data] for name, (columns, data) in tables.items()}
    applicants, activity = rows["applicants"], rows["activity"]
    statuses = {s["id"]: s for s in rows["statuses"]}
    jobs = {j["id"]: j for j in rows["jobs"]}

    for name, table in rows.items():
        check([r["id"] for r in table] == [str(i) for i in range(1, len(table) + 1)], f"{name} ids are not 1..n")
        for r in table:
            for column, value in r.items():
                if column.endswith("_at") and value:
                    check(parse_iso(value) <= now, f"{name} {r['id']} {column} is in the future")

    by_status = Counter(statuses[a["status_id"]]["key"] for a in applicants)
    for s in statuses.values():
        check(by_status[s["key"]] >= 2, f"under 2 applicants in {s['key']}: {by_status}")
    check(HIRES[0] <= by_status["HIRED"] <= HIRES[1], f"{by_status['HIRED']} hires, want {HIRES[0]} to {HIRES[1]}")
    for name, value, low, high in shape(rows):
        check(low <= value <= high, f"{name} is {value:.1%}, want {low:.0%} to {high:.0%}")

    hire_days = time_to_hire(rows)
    check(TIME_TO_HIRE_MEDIAN[0] <= median(hire_days) <= TIME_TO_HIRE_MEDIAN[1],
          f"median time to hire is {median(hire_days):.1f} days, want {TIME_TO_HIRE_MEDIAN[0]} to {TIME_TO_HIRE_MEDIAN[1]}")
    check(min(hire_days) >= TIME_TO_HIRE_FLOOR, f"fastest hire took {min(hire_days):.1f} days, want at least {TIME_TO_HIRE_FLOOR}")
    low, high, count = FAST_HIRES
    fast = sum(low <= days <= high for days in hire_days)
    check(fast >= count, f"{fast} hires took {low} to {high} days, want at least {count}: {sorted(round(d, 1) for d in hire_days)}")
    check({a["source"] for a in applicants} == {s for s, _ in SOURCES}, "a source is missing")
    check({j["status"] for j in jobs.values()} == {"OPEN", "PAUSED", "CLOSED"}, "a job status is missing")
    per_job = Counter(a["job_id"] for a in applicants)
    for job in jobs.values():
        check(job["status"] == "CLOSED" or per_job[job["id"]] >= 5, f"job {job['code']} has under 5 applicants")

    ages = [(now - parse_iso(a["applied_at"])) / DAY for a in applicants]
    check(84 <= max(ages) <= 89, f"oldest application is {max(ages):.1f} days old, want 84 to 89")
    weeks = Counter(int(age // 7) for age in ages)
    check(all(weeks[w] for w in range(13)), f"a week of the 90-day window is empty: {sorted(weeks.items())}")

    times = [parse_iso(r["created_at"]) for r in activity]
    check(times == sorted(times), "activity ids are not in time order")

    acts = defaultdict(list)
    for r in activity:
        acts[r["applicant_id"]].append(r)
    for a in applicants:
        applied = parse_iso(a["applied_at"])
        check(applied >= now - 95 * DAY, f"applicant {a['id']} applied too long ago")
        check(parse_iso(jobs[a["job_id"]]["opened_at"]) <= applied, f"applicant {a['id']} applied before the job opened")
        terminal = statuses[a["status_id"]]["is_terminal"] == "true"
        job = jobs[a["job_id"]]
        check(job["status"] != "CLOSED" or terminal, f"applicant {a['id']} is active on a closed job")
        check(job["status"] != "PAUSED" or applied <= now - 21 * DAY, f"applicant {a['id']} applied after its job paused")
        mine = acts[a["id"]]
        check(mine[0]["type"] == "APPLICATION_CREATED" and mine[0]["created_at"] == a["applied_at"],
              f"applicant {a['id']} does not start with APPLICATION_CREATED")
        current = STATUS_ID["NEW"]
        for r in mine:
            if r["type"] == "STATUS_CHANGED":
                detail = json.loads(r["detail_json"])
                check(detail["fromStatusId"] == current, f"applicant {a['id']} status chain breaks at activity {r['id']}")
                current = detail["toStatusId"]
        check(current == a["status_id"], f"applicant {a['id']} status does not match its history")
        archival = [r["type"] for r in mine if r["type"] in ("ARCHIVED", "RESTORED")]
        check(bool(a["archived_at"]) == (archival[-1:] == ["ARCHIVED"]), f"applicant {a['id']} archive state disagrees")
        check(not a["archived_at"] or terminal, f"applicant {a['id']} is archived while active")
        check((a["is_at_least_18"] == "") == (a["source"] != "APPLY_FORM"), f"applicant {a['id']} screening mismatch")

    people = {a["id"]: a for a in applicants}
    for table, entry, key in (("notes", "NOTE_ADDED", "noteId"), ("call_logs", "CALL_LOGGED", "callLogId")):
        refs = Counter((r["applicant_id"], json.loads(r["detail_json"])[key]) for r in activity if r["type"] == entry)
        for r in rows[table]:
            check(refs[(r["applicant_id"], r["id"])] == 1, f"{table} {r['id']} has no single matching activity row")
        check(sum(refs.values()) == len(rows[table]), f"{entry} rows reference missing {table}")
    for c in rows["call_logs"]:
        check(c["phone_number"] and c["phone_number"] == people[c["applicant_id"]]["phone"], f"call {c['id']} phone mismatch")
        seconds = (parse_iso(c["ended_at"]) - parse_iso(c["started_at"])).total_seconds()
        check(abs(seconds - int(c["duration_seconds"])) <= 1, f"call {c['id']} duration mismatch")

    identity = defaultdict(set)
    for a in applicants:
        identity[a["email"]].add((a["first_name"], a["last_name"], a["phone"]))
    check(all(len(v) == 1 for v in identity.values()), "one email maps to two different people")
    check(len({a["phone"] for a in applicants if a["phone"]}) == len({a["email"] for a in applicants if a["phone"]}),
          "a phone number is shared by two different people")
    check(len(applicants) - len(identity) >= 3, "too few people applied to a second requisition")
    linkedin = sum(bool(a["linkedin_url"]) for a in applicants) / len(applicants)
    check(0.3 <= linkedin <= 0.5, f"{linkedin:.0%} of applicants have LinkedIn, want roughly 40%")


def weekly(dates, now, weeks=13):
    """Counts per week, oldest first. Week 0 is the seven days ending now, as in lib/analytics.ts."""
    counts = Counter((now - date) // WEEK for date in dates if date <= now)
    return " ".join(str(counts[week]) for week in range(weeks - 1, -1, -1))


def read_tables():
    tables = {}
    for name in ("jobs", "statuses", "applicants", "notes", "call_logs", "activity"):
        with (DATA_DIR / f"{name}.csv").open(newline="", encoding="utf-8") as handle:
            columns, *data = list(csv.reader(handle))
        tables[name] = (columns, data)
    return tables


def report(tables, now, verb="Wrote"):
    rows = {name: [dict(zip(columns, row)) for row in data] for name, (columns, data) in tables.items()}
    applicants, activity = rows["applicants"], rows["activity"]
    statuses = rows["statuses"]
    label = {s["id"]: s["label"] for s in statuses}
    line = lambda name, value: print(f"  {name:<40}{value}")

    print(f"\n{verb} {DATA_DIR}: {', '.join(f'{n}.csv ({len(d)})' for n, (_, d) in tables.items())}")
    print("\nApplicants by current status")
    counts = Counter(a["status_id"] for a in applicants)
    for s in statuses:
        line(s["label"], counts[s["id"]])
    print("\nBy source")
    for source, n in sorted(Counter(a["source"] for a in applicants).items()):
        line(source, n)
    print("\nBy requisition")
    per_job = Counter(a["job_id"] for a in applicants)
    for j in rows["jobs"]:
        line(f"{j['code']} {j['title']} ({j['status'].lower()})", per_job[j["id"]])

    counts_as = {s["id"]: s["counts_as"] for s in statuses}
    reached = defaultdict(set)
    hired_at = {}
    # Time order, so the first move into an accepted status is the hire.
    for r in sorted(activity, key=lambda r: (r["created_at"], int(r["id"]))):
        if r["type"] == "STATUS_CHANGED":
            detail = json.loads(r["detail_json"])
            reached[detail["toStatusId"]].add(r["applicant_id"])
            if counts_as.get(detail["toStatusId"]) == "ACCEPTED":
                hired_at.setdefault(r["applicant_id"], parse_iso(r["created_at"]))

    # Same definition as lib/analytics.ts: open, non-terminal statuses in board
    # order, then the accepted statuses as one stage. A stage is reached by
    # entering it or by sitting in it now; everyone has reached the first.
    ordered = sorted(statuses, key=lambda s: (int(s["sort_order"]), s["key"]))
    stages = [[s["id"]] for s in ordered if s["counts_as"] == "OPEN" and s["is_terminal"] != "true"]
    accepted = [s["id"] for s in ordered if s["counts_as"] == "ACCEPTED"]
    if accepted:
        stages.append(accepted)
    print("\nFunnel (reached stage at any point)")
    previous = None
    for index, ids in enumerate(stages):
        n = len(applicants) if index == 0 else sum(
            1 for a in applicants if a["status_id"] in ids or any(a["id"] in reached[i] for i in ids)
        )
        prior = f", {n / previous:.1%} of previous" if previous else ""
        line(label[ids[0]], f"{n}  ({n / len(applicants):.1%} of all{prior})")
        previous = n
    days = [(hired_at[a["id"]] - parse_iso(a["applied_at"])) / DAY for a in applicants if a["id"] in hired_at]
    if days:
        line("Time to hire, median days", f"{median(days):.1f}  (range {min(days):.1f} to {max(days):.1f})")

    print("\nShape against --check targets")
    for name, value, low, high in shape(rows):
        line(name, f"{value:.1%}  (target {low:.0%} to {high:.0%})")

    print("\nPer week, oldest first (the last number is the seven days ending now)")
    line("applications", weekly([parse_iso(a["applied_at"]) for a in applicants], now))
    line("calls", weekly([parse_iso(c["started_at"]) for c in rows["call_logs"]], now))

    print("\nCalls by disposition")
    for disposition, n in Counter(c["disposition"] for c in rows["call_logs"]).most_common():
        line(disposition, n)
    print("\nOther")
    line("applications", len(applicants))
    line("hires (status counts as accepted)", sum(counts_as[a["status_id"]] == "ACCEPTED" for a in applicants))
    line("notes (pinned)", f"{len(rows['notes'])} ({sum(n['pinned'] == 'true' for n in rows['notes'])})")
    line("archived now", sum(bool(a["archived_at"]) for a in applicants))
    line("with LinkedIn", sum(bool(a["linkedin_url"]) for a in applicants))
    line("distinct people", len({a["email"] for a in applicants}))
    line("activity rows", len(activity))
    print("")


def write(tables):
    DATA_DIR.mkdir(exist_ok=True)
    for name, (columns, data) in tables.items():
        target = DATA_DIR / f"{name}.csv"
        temp = DATA_DIR / f"{name}.csv.seed-tmp"
        with temp.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerow(columns)
            writer.writerows(data)
        # Atomic swap, so a running app never reads a half-written table.
        os.replace(temp, target)


def main(argv):
    if "--report" in argv:
        # Read-only: reports on data/ as it is now, including anything the app has
        # written. An independent check on the numbers /analytics shows.
        report(read_tables(), datetime.now(UTC), verb="Read")
        return
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    if "--check" in argv:
        check(build(now) == build(now), "two builds at the same instant differ")
        for offset in range(14):
            validate(build(now + offset * DAY), now + offset * DAY)
        print("seed check passed for 14 consecutive days")
        return
    tables = build(now)
    validate(tables, now)
    write(tables)
    report(tables, now)


if __name__ == "__main__":
    main(sys.argv[1:])
