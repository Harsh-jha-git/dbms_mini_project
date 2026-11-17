#!/usr/bin/env python3
"""Generates 03_seed.sql with random but internally consistent demo data.
Run:  python gen_seed.py    (writes 03_seed.sql next to this file)
The data respects every rule in the schema: eligibility, tier lock, openings/filled."""
import random, os
from datetime import date, datetime, timedelta

random.seed(42)
TODAY = date(2026, 11, 3)
N_STUDENTS = 200

BRANCHES = ["Computer Science", "Information Science", "Electronics & Communication",
            "Electrical Engineering", "Mechanical Engineering", "Civil Engineering"]
FIRST_M = ["Aarav","Vihaan","Arjun","Rohan","Karthik","Rahul","Siddharth","Aditya","Nikhil","Manish","Varun","Harsh","Pranav","Dev","Ishaan","Tejas","Naveen","Suresh","Vikram","Yash"]
FIRST_F = ["Ananya","Diya","Priya","Sneha","Kavya","Meera","Ishita","Riya","Neha","Pooja","Aishwarya","Shreya","Divya","Anjali","Lakshmi","Nandini","Tanvi","Swati","Bhavana","Charu"]
LAST = ["Sharma","Reddy","Iyer","Nair","Gowda","Patel","Singh","Kulkarni","Rao","Menon","Das","Joshi","Bhat","Shetty","Verma","Mehta","Naidu","Pillai","Hegde","Kapoor"]
COMPANIES = [("Nimbus Systems","Software"),("Orbit Analytics","Data & AI"),("Kestrel Networks","Telecom"),
 ("Bluefin Payments","Fintech"),("Lumen Robotics","Robotics"),("Quarry Infra","Construction"),
 ("Vertex Semiconductors","Electronics"),("Harbor Logistics","Logistics"),("Pinecone Health","Healthtech"),
 ("Cobalt Motors","Automotive"),("Ember Energy","Energy"),("Skyline Cloud","Cloud"),
 ("Tessera Games","Gaming"),("Meridian Bank Tech","Banking"),("Zephyr Aerospace","Aerospace"),("Atlas Consulting","Consulting")]
CITIES = ["Bengaluru","Hyderabad","Pune","Chennai","Mumbai","Gurugram"]
TITLES_FT = ["Software Engineer","Graduate Engineer Trainee","Data Analyst","Systems Engineer","Associate Engineer","Backend Developer","Embedded Engineer","Design Engineer","Site Engineer","Business Analyst"]
TITLES_IN = ["Software Intern","Data Intern","Embedded Systems Intern","Design Intern","Research Intern","QA Intern","Site Intern","Analytics Intern"]
FEEDBACK = ["Strong fundamentals, clear communication","Good problem solving, needs depth in system design","Confident and well prepared","Average performance in the technical round","Excellent project discussion","Needs improvement in core subjects"]

def q(s): return "'" + str(s).replace("'", "''") + "'"
def clamp(x, lo, hi): return max(lo, min(hi, x))
def tier_rank(t, amt):
    if t != "Full-time": return None
    return 4 if amt >= 1200000 else 3 if amt >= 700000 else 2 if amt >= 450000 else 1
def ts(d, h=None): return datetime(d.year, d.month, d.day, h if h is not None else random.randint(9, 18), random.randint(0, 59), 0).strftime("%Y-%m-%d %H:%M:%S")

# ---- students ----
students, scores = [], []
for i in range(1, N_STUDENTS + 1):
    g = random.choice(["Male", "Female", "Female", "Male", "Other"] if random.random() < .03 else ["Male", "Female"])
    first = random.choice(FIRST_F if g == "Female" else FIRST_M)
    name = f"{first} {random.choice(LAST)}"
    ability = random.gauss(0, 1)
    cgpa = round(clamp(7.3 + 0.9 * ability + random.gauss(0, .4), 5.0, 9.9), 2)
    backlogs = 0 if random.random() < .8 else random.randint(1, 3)
    students.append(dict(id=i, name=name, email=f"{first.lower()}.{i}@campus.edu", age=random.choice([20,21,21,22,22,23]),
        gender=g, cgpa=cgpa, backlogs=backlogs, att=round(random.uniform(66, 98), 2), branch=random.randint(1, len(BRANCHES))))
    sc = lambda m=65, s=12: round(clamp(m + s * ability + random.gauss(0, 8), 20, 100), 2)
    scores.append(dict(id=i, coding=sc(), apt=sc(), logic=sc(), comm=sc(), mock=sc(),
        certs=random.randint(0, 6), proj=random.randint(0, 6), repos=random.randint(0, 30), intern=random.choice([0,0,1,1,2,3])))
S = {s["id"]: s for s in students}; SC = {s["id"]: s for s in scores}

# ---- companies, recruiters ----
recruiters = []
for ci, (cn, ind) in enumerate(COMPANIES, 1):
    for k in range(2):
        rid = len(recruiters) + 1
        recruiters.append(dict(id=rid, company=ci, name=f"{random.choice(FIRST_M+FIRST_F)} {random.choice(LAST)}",
            email=f"hr{rid}@{cn.split()[0].lower()}.com", desig=random.choice(["HR Manager","Talent Acquisition Lead","Campus Recruiter"])))

# ---- opportunities ----
opps = []
for oid in range(1, 61):
    r = random.choice(recruiters)
    typ = "Internship" if random.random() < .4 else "Full-time"
    if typ == "Full-time":
        amt = random.choice([380000,420000,480000,550000,650000,720000,850000,1000000,1250000,1600000,2000000])
        title = random.choice(TITLES_FT)
    else:
        amt = random.choice([15000,20000,25000,30000,40000,50000]); title = random.choice(TITLES_IN)
    appr = random.choices(["Approved","Pending","Rejected"], [.85, .10, .05])[0]
    deadline = TODAY + timedelta(days=random.randint(-25, 45))
    rk = tier_rank(typ, amt)
    ft = typ == "Full-time"
    crit = dict(cgpa={4:8.0,3:7.5,2:7.0,1:6.0,None:6.5}[rk], backlogs={4:0,3:0,2:1,1:2,None:1}[rk],
                att=75, apt=random.choice([50,55,60,65]), comm=random.choice([45,50,55,60]))
    opps.append(dict(id=oid, company=r["company"], rec=r["id"], title=title, type=typ, amt=amt,
        loc=random.choice(CITIES), mode=random.choice(["Onsite","Remote","Hybrid"]),
        start=deadline + timedelta(days=random.randint(30, 120)), deadline=deadline, approval=appr,
        openings=random.randint(1, 5) if ft else random.randint(1, 6), rank=rk, crit=crit,
        branches=random.sample(range(1, len(BRANCHES)+1), random.randint(2, 5)), selected=0))
O = {o["id"]: o for o in opps}

def eligible(s, o):
    c, sc, st = o["crit"], SC[s["id"]], s
    return (s["branch"] in o["branches"] and st["cgpa"] >= c["cgpa"] and st["backlogs"] <= c["backlogs"]
            and st["att"] >= c["att"] and sc["apt"] >= c["apt"] and sc["comm"] >= c["comm"])

# ---- applications ----
apps = []
approved = [o for o in opps if o["approval"] == "Approved"]
for s in students:
    pool = [o for o in approved if eligible(s, o)]
    for o in random.sample(pool, min(len(pool), random.randint(2, 7))):
        past = o["deadline"] < TODAY
        weights = [("Selected",.20),("Rejected",.35),("Withdrawn",.10),("Interview",.35)] if past else \
                  [("Applied",.35),("Shortlisted",.20),("Interview",.15),("Selected",.12),("Rejected",.13),("Withdrawn",.05)]
        status = random.choices([w[0] for w in weights], [w[1] for w in weights])[0]
        if status == "Selected":
            if o["selected"] >= o["openings"]: status = "Rejected"
            else: o["selected"] += 1
        applied = min(o["deadline"], TODAY) - timedelta(days=random.randint(1, 20))
        apps.append(dict(id=len(apps)+1, s=s["id"], o=o["id"], status=status, applied=applied, offer=None))

# ---- offers for Selected applications ----
for a in apps:
    if a["status"] == "Selected":
        st = random.choices(["Offered","Accepted","Declined"], [.40,.45,.15])[0]
        od = min(TODAY, a["applied"] + timedelta(days=random.randint(10, 25)))
        a["offer"] = dict(status=st, date=od, join=od + timedelta(days=random.randint(30, 120)))
        if st == "Declined": a["status"] = "Withdrawn"

# ---- enforce tier lock per student (at most one accepted full-time offer, rest cleaned up) ----
by_student = {}
for a in apps: by_student.setdefault(a["s"], []).append(a)
for sid, lst in by_student.items():
    acc = [a for a in lst if a["offer"] and a["offer"]["status"] == "Accepted" and O[a["o"]]["type"] == "Full-time"]
    if not acc: continue
    best = max(acc, key=lambda a: O[a["o"]]["rank"]); R = O[best["o"]]["rank"]
    for a in acc:
        if a is not best: a["offer"]["status"] = "Declined"; a["status"] = "Withdrawn"
    for a in lst:
        o = O[a["o"]]
        if a is best or o["type"] != "Full-time" or o["rank"] > R: continue
        if a["status"] in ("Applied", "Shortlisted", "Interview"): a["status"] = "Withdrawn"
        if a["offer"] and a["offer"]["status"] == "Offered": a["offer"]["status"] = "Declined"; a["status"] = "Withdrawn"

# ---- filled counts and opportunity status ----
for o in opps: o["filled"] = 0
for a in apps:
    if a["offer"] and a["offer"]["status"] in ("Offered", "Accepted"): O[a["o"]]["filled"] += 1
for o in opps:
    assert o["filled"] <= o["openings"]
    o["status"] = "Closed" if (o["filled"] >= o["openings"] or o["deadline"] < TODAY) else "Open"

# ---- interviews ----
interviews = []
for a in apps:
    n = {"Interview": 2, "Selected": 3}.get(a["status"], 1 if (a["status"] == "Rejected" and random.random() < .5) or (a["offer"]) else 0)
    if a["offer"] and a["status"] == "Withdrawn": n = 3
    for r in range(1, n + 1):
        last_open = a["status"] == "Interview" and r == n
        when = a["applied"] + timedelta(days=3 * r) if not last_open else TODAY + timedelta(days=random.randint(1, 10))
        interviews.append(dict(app=a["id"], rec=O[a["o"]]["rec"], rnd=r, typ=["Aptitude","Technical","HR"][r-1],
            when=when, status="Scheduled" if last_open else "Completed", fb=None if last_open else random.choice(FEEDBACK)))

# ---- write SQL ----
out = ["-- Generated by gen_seed.py. Demo password for every account: demo123", "USE internship_recruitment_db;", ""]
def ins(table, cols, rows):
    for i in range(0, len(rows), 100):
        out.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n" + ",\n".join("(" + ", ".join(r) + ")" for r in rows[i:i+100]) + ";")
    out.append("")
N = lambda v: "NULL" if v is None else str(v)
ins("branch", ["branch_id","branch_name"], [[str(i), q(b)] for i, b in enumerate(BRANCHES, 1)])
ins("student", ["student_id","name","email","age","gender","cgpa","backlogs","attendance_percentage","branch_id"],
    [[str(s["id"]), q(s["name"]), q(s["email"]), str(s["age"]), q(s["gender"]), str(s["cgpa"]), str(s["backlogs"]), str(s["att"]), str(s["branch"])] for s in students])
ins("student_scores", ["student_id","coding_skill_score","aptitude_score","logical_reasoning_score","communication_skill_score","mock_interview_score","certifications_count","projects_count","github_repos","internships_count"],
    [[str(s["id"]), str(s["coding"]), str(s["apt"]), str(s["logic"]), str(s["comm"]), str(s["mock"]), str(s["certs"]), str(s["proj"]), str(s["repos"]), str(s["intern"])] for s in scores])
ins("company", ["company_id","company_name","industry","website","location"],
    [[str(i), q(n), q(ind), q("https://www." + n.split()[0].lower() + ".com"), q(random.choice(CITIES))] for i, (n, ind) in enumerate(COMPANIES, 1)])
ins("recruiter", ["recruiter_id","company_id","name","email","designation"],
    [[str(r["id"]), str(r["company"]), q(r["name"]), q(r["email"]), q(r["desig"])] for r in recruiters])
ins("opportunity", ["opportunity_id","company_id","recruiter_id","title","`type`","stipend_or_ctc","location","`mode`","start_date","application_deadline","status","approval_status","openings","filled"],
    [[str(o["id"]), str(o["company"]), str(o["rec"]), q(o["title"]), q(o["type"]), str(o["amt"]), q(o["loc"]), q(o["mode"]), q(o["start"]), q(o["deadline"]), q(o["status"]), q(o["approval"]), str(o["openings"]), str(o["filled"])] for o in opps])
ins("opportunity_branch", ["opportunity_id","branch_id"], [[str(o["id"]), str(b)] for o in opps for b in o["branches"]])
ins("eligibility_criteria", ["opportunity_id","min_cgpa","max_backlogs","min_attendance","min_aptitude_score","min_communication_score"],
    [[str(o["id"]), str(o["crit"]["cgpa"]), str(o["crit"]["backlogs"]), str(o["crit"]["att"]), str(o["crit"]["apt"]), str(o["crit"]["comm"])] for o in opps])
ins("application", ["application_id","student_id","opportunity_id","applied_on","status"],
    [[str(a["id"]), str(a["s"]), str(a["o"]), q(ts(a["applied"])), q(a["status"])] for a in apps])
offers = [a for a in apps if a["offer"]]
ins("offer", ["application_id","offer_type","salary_stipend","offer_date","joining_date","status"],
    [[str(a["id"]), q(O[a["o"]]["type"]), str(O[a["o"]]["amt"]), q(a["offer"]["date"]), q(a["offer"]["join"]), q(a["offer"]["status"])] for a in offers])
ins("interview", ["application_id","interviewer_id","round_no","round_type","scheduled_at","status","feedback"],
    [[str(i["app"]), str(i["rec"]), str(i["rnd"]), q(i["typ"]), q(ts(i["when"])), q(i["status"]), "NULL" if i["fb"] is None else q(i["fb"])] for i in interviews])
out.append("INSERT INTO users (username, password_hash, role, student_id, recruiter_id)\nVALUES ('officer', SHA2('demo123', 256), 'officer', NULL, NULL);")
out.append("INSERT INTO users (username, password_hash, role, student_id, recruiter_id)\nSELECT CONCAT('student', student_id), SHA2('demo123', 256), 'student', student_id, NULL FROM student;")
out.append("INSERT INTO users (username, password_hash, role, student_id, recruiter_id)\nSELECT CONCAT('recruiter', recruiter_id), SHA2('demo123', 256), 'recruiter', NULL, recruiter_id FROM recruiter;")

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "03_seed.sql")
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
from collections import Counter
print("students", len(students), "| opportunities", len(opps), "| applications", len(apps), "| offers", len(offers), "| interviews", len(interviews))
print("application status:", dict(Counter(a["status"] for a in apps)))
print("offer status:", dict(Counter(a["offer"]["status"] for a in offers)))
print("opp approval:", dict(Counter(o["approval"] for o in opps)), "| open:", sum(o["status"] == "Open" and o["approval"] == "Approved" for o in opps))
