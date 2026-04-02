"""StepOut action string parsing and rulebook validation."""

import re

ACTION_RULES = {
    # Passing
    "SP": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    "LP": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    "TB": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    "C": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    # Shooting / Ball control / Defending / Physical
    "LS": {"start": True, "end": True, "notes": {"0", "1", "2", "3", "4"}},
    "CS": {"start": True, "end": True, "notes": {"0", "1", "2", "3", "4"}},
    "H": {"start": True, "end": True, "notes": {"0", "1", "2", "3", "4"}},
    "PC": {"start": True, "end": True, "notes": {"1", "2", "3"}},
    "DC": {"start": True, "end": False, "notes": {"0", "1"}},
    "DR": {"start": True, "end": True, "notes": {"0", "1", "2"}},
    "ST": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "SL": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "IN": {"start": True, "end": False, "notes": {"1", "2"}},
    "CL": {"start": True, "end": False, "notes": {"0","1", "2", "3"}},
    "PR": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "GD": {"start": True, "end": False, "notes": {"0", "1"}},
    "AD": {"start": True, "end": False, "notes": {"0", "1"}},
    # Goalkeeping
    "GS": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "GH": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "GT": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    # Special actions
    "CN": {"start": True, "end": True, "notes": {"0", "1", "2", "3", "4"}},
    "OG": {"start": True, "end": True, "notes": {"1"}},
    "OFF": {"start": True, "end": False, "notes": {"1"}},
    "F": {"start": True, "end": False, "notes": {"1"}},
    "YC": {"start": True, "end": False, "notes": {"1"}},
    "RC": {"start": True, "end": False, "notes": {"1"}},
    "PK": {"start": True, "end": True, "notes": {"0", "1", "2", "3", "4"}},
    "FK": {"start": True, "end": True, "notes": {"1"}},
    "HB": {"start": True, "end": False, "notes": {"1"}},
    "GK": {"start": True, "end": True, "notes": {"1"}},
    "THW": {"start": True, "end": True, "notes": {"0", "1", "2", "3"}},
    # Receiver actions
    "XSP": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "XLP": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "XTB": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "XC": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "XDR": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "XIN": {"start": True, "end": False, "notes": {"1", "2"}},
    "XST": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "XSL": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "XAD": {"start": True, "end": False, "notes": {"0", "1"}},
    "XGD": {"start": True, "end": False, "notes": {"0", "1"}},
    "XPR": {"start": True, "end": False, "notes": {"0", "1", "2"}},
    "XGT": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
    "XTHW": {"start": True, "end": False, "notes": {"0", "1", "2", "3"}},
}

ACTION_DISPLAY_NAMES = {
    "SP": "Short Pass",
    "LP": "Long Pass",
    "TB": "Through Ball",
    "C": "Cross",
    "LS": "Long Shot",
    "CS": "Close Shot",
    "H": "Header",
    "PC": "Ball Carry",
    "DC": "Ball Control",
    "DR": "Dribble",
    "ST": "Standing Tackle",
    "SL": "Sliding Tackle",
    "IN": "Interception",
    "CL": "Clearance",
    "PR": "Press",
    "GD": "Ground Duel",
    "AD": "Aerial Duel",
    "GS": "Goalkeeper Save",
    "GH": "Goalkeeper Handling",
    "GT": "Goalkeeper Throw",
    "CN": "Corner",
    "OG": "Own Goal",
    "OFF": "Offside",
    "F": "Foul",
    "YC": "Yellow Card",
    "RC": "Red Card",
    "PK": "Penalty Kick",
    "FK": "Free Kick",
    "HB": "Hand Ball",
    "GK": "Goal Kick",
    "THW": "Throw In",
    "XSP": "Received Short Pass",
    "XLP": "Received Long Pass",
    "XTB": "Received Through Ball",
    "XC": "Received Cross",
    "XDR": "Received Dribble",
    "XIN": "Received Interception",
    "XST": "Received Standing Tackle",
    "XSL": "Received Sliding Tackle",
    "XAD": "Received Aerial Duel",
    "XGD": "Received Ground Duel",
    "XPR": "Received Press",
    "XGT": "Received Goalkeeper Throw",
    "XTHW": "Received Throw In",
}

VALID_TEAMS = {"A", "B"}
VALID_FOOT = {"R", "L", "X"}
VALID_HALF = {"FHN", "FHI", "SHN", "SHI", "ET1N", "ET1I", "ET2N", "ET2I", "PK"}
VALID_SPECIAL = {"X", "F", "YC", "RC", "FK", "PK", "CN", "HB", "OFF", "GK", "OG"}

TIME_RE = re.compile(r"^\d{1,2}:\d{2}:\d{2}$")
GRID_RE = re.compile(r"^\d{1,2}$")


def normalize(s: str) -> str:
    if not s:
        return ""
    return s.replace("\n", "").replace("\r", "").strip().strip(",")


def parse_string(s: str) -> dict:
    """
    Parses a single StepOut action string.
    Format:
    Team-Jersey-Action-Notation-Start-End-Time-Foot-Special-Half-Z1-Z2
    """
    s = normalize(s)
    if not s:
        raise ValueError("Empty string")

    parts = s.split("-")
    if len(parts) == 10:
        # Temporary compatibility mode:
        # if z-axis attributes are missing, default them to X.
        parts = parts + ["X", "X"]
    elif len(parts) != 12:
        raise ValueError(f"Invalid format: Expected 10 or 12 parts, got {len(parts)} in: {s}")

    return {
        "team": parts[0].strip().upper(),
        "jersey_number": parts[1].strip(),
        "action": parts[2].strip().upper(),
        "attribute": parts[3].strip(),  # notation
        "starting_grid": parts[4].strip().upper(),
        "end_grid": parts[5].strip().upper(),
        "timestamp": parts[6].strip(),
        "foot": parts[7].strip().upper(),
        "special_action": parts[8].strip().upper(),
        "half_notation": parts[9].strip().upper(),
        "z_axis_1": parts[10].strip().upper(),
        "z_axis_2": parts[11].strip().upper(),
    }


def _is_missing(value: str) -> bool:
    return str(value).strip().upper() in {"", "X", "NA", "N/A", "NONE", "-"}


def _is_valid_grid(value: str) -> bool:
    if _is_missing(value):
        return True
    if not GRID_RE.match(value):
        return False
    n = int(value)
    return 0 <= n <= 99


def _add_error(errors: dict, field: str, expected: str, predicted: str):
    errors[field] = {"expected": expected, "predicted": str(predicted)}


def _validate_special_dependencies(parsed: dict, errors: dict):
    """Validates known special-action dependencies from rulebook guidance."""
    action = parsed["action"]
    note = parsed["attribute"]
    special = parsed["special_action"]

    if special in {"F", "YC", "RC"}:
        allowed_foul_combos = {("ST", "0"), ("SL", "0"), ("GD", "0"), ("AD", "0")}
        if (action, note) not in allowed_foul_combos:
            _add_error(
                errors,
                "rule_special_action",
                "F/YC/RC allowed with ST-0, SL-0, GD-0, AD-0",
                f"{action}-{note} with {special}",
            )

    if special == "PK" and action not in {"CS"}:
        _add_error(errors, "rule_special_action", "PK only with CS action", f"{action}-{note}")

    if special == "FK" and action not in {"SP", "LP", "TB", "C", "LS", "FK"}:
        _add_error(errors, "rule_special_action", "FK with passing actions/LS/FK", action)

    if special == "CN" and action not in {"SP", "LP", "TB", "C", "LS", "CN"}:
        _add_error(errors, "rule_special_action", "CN with passing actions/LS/CN", action)

    if special == "GK" and action not in {"SP", "LP", "GK"}:
        _add_error(errors, "rule_special_action", "GK with SP/LP/GK", action)

    if special == "OFF" and action != "OFF":
        _add_error(errors, "rule_special_action", "OFF special should use OFF action", action)

    if special == "HB" and action != "HB":
        _add_error(errors, "rule_special_action", "HB special should use HB action", action)

    if special == "OG" and action != "OG":
        _add_error(errors, "rule_special_action", "OG special should use OG action", action)


def validate_rulebook(parsed: dict) -> dict:
    """
    Validates parsed action against StepOut rulebook.
    Returns errors in the same structure used by mismatch UI.
    """
    errors = {}

    team = parsed.get("team", "")
    jersey = parsed.get("jersey_number", "")
    action = parsed.get("action", "")
    note = parsed.get("attribute", "")
    start_grid = parsed.get("starting_grid", "")
    end_grid = parsed.get("end_grid", "")
    timestamp = parsed.get("timestamp", "")
    foot = parsed.get("foot", "")
    special = parsed.get("special_action", "")
    half = parsed.get("half_notation", "")

    if team not in VALID_TEAMS:
        _add_error(errors, "rule_team", "A or B", team)

    if not jersey.isdigit():
        _add_error(errors, "rule_jersey_number", "numeric jersey number", jersey)

    rule = ACTION_RULES.get(action)
    if not rule:
        _add_error(errors, "rule_action", f"one of: {', '.join(sorted(ACTION_RULES))}", action or "(empty)")
        return errors

    if note not in rule["notes"]:
        _add_error(
            errors,
            "rule_note",
            f"one of: {', '.join(sorted(rule['notes']))}",
            note or "(empty)",
        )

    if rule["start"] and _is_missing(start_grid):
        _add_error(errors, "rule_starting_grid", "start grid required", start_grid)
    if not _is_valid_grid(start_grid):
        _add_error(errors, "rule_starting_grid", "valid grid 0-99 or X", start_grid)

    if rule["end"] and _is_missing(end_grid):
        _add_error(errors, "rule_end_grid", "end grid required", end_grid)
    if not rule["end"] and not _is_missing(end_grid):
        _add_error(errors, "rule_end_grid", "X (end grid not allowed for this action)", end_grid)
    if not _is_valid_grid(end_grid):
        _add_error(errors, "rule_end_grid", "valid grid 0-99 or X", end_grid)

    if not TIME_RE.match(timestamp):
        _add_error(errors, "rule_timestamp", "H:MM:SS", timestamp)

    if foot not in VALID_FOOT:
        _add_error(errors, "rule_foot", "R, L or X", foot)

    if special not in VALID_SPECIAL:
        _add_error(errors, "rule_special_action", f"one of: {', '.join(sorted(VALID_SPECIAL))}", special)
    else:
        _validate_special_dependencies(parsed, errors)

    if half not in VALID_HALF:
        _add_error(errors, "rule_half_notation", f"one of: {', '.join(sorted(VALID_HALF))}", half)

    return errors
