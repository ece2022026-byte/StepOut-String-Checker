from comparator import compare_strings
from parser import normalize, parse_string, validate_rulebook, ACTION_RULES, ACTION_DISPLAY_NAMES

PASSING_ACTIONS = {"SP", "LP", "TB", "C", "XSP", "XLP", "XTB", "XC"}
RECEIVER_ACTIONS = {a for a in ACTION_RULES.keys() if a.startswith("X")}
SPECIAL_PRESENCE_ACTIONS = {"FK", "OG", "CN", "GK", "F", "YC", "RC", "OFF", "HB", "PK"}
SPECIAL_NOTE_KEY = "__PRESENCE__"
TEAM_BUCKETS = ("A", "B", "OTHER")
KEY_ACTION_SECTIONS = [
    {
        "id": "passing",
        "title": "Key Passing Actions",
        "items": [("SP", "2"), ("SP", "3"), ("LP", "2"), ("LP", "3"), ("TB", "2"), ("TB", "3"), ("C", "2"), ("C", "3")],
    },
    {
        "id": "shooting",
        "title": "Key Shooting Actions",
        "items": [("LS", "2"), ("LS", "3"), ("CS", "2"), ("CS", "3"), ("H", "2"), ("H", "3")],
    },
    {
        "id": "defensive",
        "title": "Defensive Key Actions",
        "items": [("IN", "2"), ("CL", "2"), ("CL", "3"), ("SL", "2"), ("ST", "2")],
    },
]
KEY_ACTION_NOTES = [item for section in KEY_ACTION_SECTIONS for item in section["items"]]


def _note_bucket_for_breakdown(action, note):
    """
    Special actions are presence markers, so collapse them into one bucket
    instead of showing synthetic keys like FK-0/FK-1.
    """
    if action in SPECIAL_PRESENCE_ACTIONS:
        return SPECIAL_NOTE_KEY
    return str(note)


def _is_countable_action(parsed, action):
    """
    Business rule:
    count GD/AD only when foot is R or L.
    """
    if action in {"GD", "AD"}:
        return str(parsed.get("foot", "")).upper() in {"R", "L"}
    return True


def _sort_note_keys(note_keys):
    return sorted(
        [str(note) for note in note_keys],
        key=lambda value: (0, int(value)) if str(value).isdigit() else (1, str(value)),
    )


def _valid_note_buckets_for_action(action):
    if action in SPECIAL_PRESENCE_ACTIONS:
        return [SPECIAL_NOTE_KEY]
    rule = ACTION_RULES.get(action, {})
    return _sort_note_keys(rule.get("notes", []))


def _init_note_count_map(action):
    return {note: 0 for note in _valid_note_buckets_for_action(action)}


def _counted_actions_for_string(parsed):
    counted = []
    action = parsed.get("action")
    if action in ACTION_RULES and _is_countable_action(parsed, action):
        counted.append(action)

    special_action = parsed.get("special_action")
    if (
        special_action in ACTION_RULES
        and special_action != "X"
        and special_action != action
        and _is_countable_action(parsed, special_action)
    ):
        counted.append(special_action)

    return counted


def _build_attribute_counts(strings, strict_validation=False):
    """
    strict_validation=False:
      Count parsed attributes directly (used for gold).
    strict_validation=True:
      Count only attributes that pass rulebook validation (used for trainee).
    """
    counts = {action: 0 for action in ACTION_RULES.keys()}
    skipped = 0

    for raw in strings:
        try:
            parsed = parse_string(raw)
        except Exception:
            skipped += 1
            continue

        action = parsed.get("action")
        if action not in counts:
            skipped += 1
            continue

        if strict_validation:
            errors = validate_rulebook(parsed)
            if errors:
                skipped += 1
                continue

        for counted_action in _counted_actions_for_string(parsed):
            counts[counted_action] += 1

    return counts, skipped


def _build_attribute_note_breakdown(gold_list, trainee_list):
    """
    Builds note-level counts per action for both gold and trainee strings.
    Example:
      breakdown["CS"]["gold"] -> {"0": 3, "2": 4, "3": 2, "4": 1}
    """
    labels = list(ACTION_RULES.keys())
    breakdown = {
        action: {
            "gold": _init_note_count_map(action),
            "trainee": _init_note_count_map(action),
        }
        for action in labels
    }

    for raw in gold_list:
        parsed = _safe_parse(raw)
        if not parsed:
            continue
        note = str(parsed.get("attribute", ""))
        for action in _counted_actions_for_string(parsed):
            if action not in breakdown:
                continue
            action_bucket = _note_bucket_for_breakdown(action, note)
            breakdown[action]["gold"][action_bucket] = breakdown[action]["gold"].get(action_bucket, 0) + 1

    for raw in trainee_list:
        parsed = _safe_parse(raw)
        if not parsed:
            continue
        note = str(parsed.get("attribute", ""))
        for action in _counted_actions_for_string(parsed):
            if action not in breakdown:
                continue
            action_bucket = _note_bucket_for_breakdown(action, note)
            breakdown[action]["trainee"][action_bucket] = breakdown[action]["trainee"].get(action_bucket, 0) + 1

    return breakdown


def _build_attribute_team_breakdown(gold_list, trainee_list):
    breakdown = {
        action: {
            "gold": {team: 0 for team in TEAM_BUCKETS},
            "trainee": {team: 0 for team in TEAM_BUCKETS},
        }
        for action in ACTION_RULES.keys()
    }

    for source_name, source_list in (("gold", gold_list), ("trainee", trainee_list)):
        for raw in source_list:
            parsed = _safe_parse(raw)
            if not parsed:
                continue

            team = str(parsed.get("team", "")).upper()
            team_bucket = team if team in {"A", "B"} else "OTHER"
            for action in _counted_actions_for_string(parsed):
                if action not in breakdown:
                    continue
                breakdown[action][source_name][team_bucket] += 1

    return breakdown


def _build_attribute_team_note_breakdown(gold_list, trainee_list):
    breakdown = {
        action: {
            "gold": {team: _init_note_count_map(action).copy() for team in TEAM_BUCKETS},
            "trainee": {team: _init_note_count_map(action).copy() for team in TEAM_BUCKETS},
        }
        for action in ACTION_RULES.keys()
    }

    for source_name, source_list in (("gold", gold_list), ("trainee", trainee_list)):
        for raw in source_list:
            parsed = _safe_parse(raw)
            if not parsed:
                continue

            team = str(parsed.get("team", "")).upper()
            team_bucket = team if team in {"A", "B"} else "OTHER"
            note = str(parsed.get("attribute", ""))

            for action in _counted_actions_for_string(parsed):
                if action not in breakdown:
                    continue
                note_bucket = _note_bucket_for_breakdown(action, note)
                breakdown[action][source_name][team_bucket][note_bucket] = breakdown[action][source_name][team_bucket].get(note_bucket, 0) + 1

    return breakdown


def _safe_parse(raw):
    try:
        return parse_string(raw)
    except Exception:
        return None


def _compare_with_meta(gold_str, trainee_str, time_tolerance):
    """
    Backward-safe unpacking for compare_strings:
    supports old (accuracy, errors) and new (accuracy, errors, warnings).
    """
    result = compare_strings(gold_str, trainee_str, time_tolerance)
    if isinstance(result, tuple) and len(result) == 3:
        return result
    if isinstance(result, tuple) and len(result) == 2:
        accuracy, errors = result
        return accuracy, errors, {}
    return 0.0, {"rule_internal": {"expected": "valid comparator tuple", "predicted": str(result)}}, {}


def _pair_score(errors):
    """
    Alignment score for pairing one gold event with one trainee event.
    Higher is better.
    """
    if not errors:
        return 6.0

    penalty = float(len(errors))
    if "half_notation" in errors:
        penalty += 3.0
    if "action" in errors:
        penalty += 2.0
    if "team" in errors:
        penalty += 1.0
    if "jersey_number" in errors:
        penalty += 1.0

    return 4.0 - penalty


def _time_to_ms_fast(ts):
    try:
        h, m, s = map(int, str(ts).split(":"))
        return h * 3600000 + m * 60000 + s * 1000
    except Exception:
        return None


def _pair_score_fast(gold_parsed, trainee_parsed, gold_ms, trainee_ms, time_tolerance):
    """
    Fast alignment scorer used inside DP.
    Avoids expensive full compare/rule validation in the inner loop.
    """
    if not gold_parsed or not trainee_parsed:
        return -5.0

    gold_action = gold_parsed.get("action", "")
    trainee_action = trainee_parsed.get("action", "")

    # Prevent alignment drift:
    # if only one side is a receiver action (X*), prefer gap (INS/DEL)
    # over forcing a mismatched match against the next normal action.
    gold_is_receiver = gold_action in RECEIVER_ACTIONS
    trainee_is_receiver = trainee_action in RECEIVER_ACTIONS
    if gold_is_receiver != trainee_is_receiver:
        return -10.0

    score = 0.0

    # Strong anchors.
    if gold_parsed.get("half_notation") == trainee_parsed.get("half_notation"):
        score += 2.5
    else:
        score -= 2.5

    if gold_ms is not None and trainee_ms is not None:
        drift = abs(gold_ms - trainee_ms)
        if drift <= time_tolerance:
            score += 2.0
        elif drift <= max(time_tolerance * 3, 6000):
            score += 0.5
        else:
            score -= 2.0

    # Secondary identity fields.
    if gold_parsed.get("team") == trainee_parsed.get("team"):
        score += 1.0
    else:
        score -= 1.0

    if gold_parsed.get("jersey_number") == trainee_parsed.get("jersey_number"):
        score += 1.0
    else:
        score -= 1.0

    if gold_action == trainee_action:
        score += 1.5
    else:
        score -= 1.5

    return score


def _align_sequences(gold_list, trainee_list, time_tolerance):
    """
    Banded dynamic alignment:
    - MATCH: pair gold[i] with trainee[j]
    - DEL: gold[i] is missed
    - INS: trainee[j] is extra
    """
    n = len(gold_list)
    m = len(trainee_list)
    if n == 0 and m == 0:
        return []
    if n == 0:
        return [("INS", None, j) for j in range(m)]
    if m == 0:
        return [("DEL", i, None) for i in range(n)]

    gap_penalty = 2.5
    band = max(25, abs(n - m) + 20)

    neg_inf = float("-inf")
    dp = [[neg_inf] * (m + 1) for _ in range(n + 1)]
    prev = [[None] * (m + 1) for _ in range(n + 1)]
    parsed_gold = [_safe_parse(x) for x in gold_list]
    parsed_trainee = [_safe_parse(x) for x in trainee_list]
    gold_ms = [_time_to_ms_fast((p or {}).get("timestamp")) for p in parsed_gold]
    trainee_ms = [_time_to_ms_fast((p or {}).get("timestamp")) for p in parsed_trainee]

    dp[0][0] = 0.0
    for i in range(1, n + 1):
        if i <= band:
            dp[i][0] = dp[i - 1][0] - gap_penalty
            prev[i][0] = ("DEL", i - 1, None)
    for j in range(1, m + 1):
        if j <= band:
            dp[0][j] = dp[0][j - 1] - gap_penalty
            prev[0][j] = ("INS", None, j - 1)

    for i in range(1, n + 1):
        j_start = max(1, i - band)
        j_end = min(m, i + band)
        for j in range(j_start, j_end + 1):
            best_score = neg_inf
            best_prev = None

            # DEL
            if dp[i - 1][j] != neg_inf:
                s = dp[i - 1][j] - gap_penalty
                if s > best_score:
                    best_score = s
                    best_prev = ("DEL", i - 1, None)

            # INS
            if dp[i][j - 1] != neg_inf:
                s = dp[i][j - 1] - gap_penalty
                if s > best_score:
                    best_score = s
                    best_prev = ("INS", None, j - 1)

            # MATCH
            if dp[i - 1][j - 1] != neg_inf:
                s = dp[i - 1][j - 1] + _pair_score_fast(
                    parsed_gold[i - 1],
                    parsed_trainee[j - 1],
                    gold_ms[i - 1],
                    trainee_ms[j - 1],
                    time_tolerance,
                )
                if s > best_score:
                    best_score = s
                    best_prev = ("MATCH", i - 1, j - 1)

            dp[i][j] = best_score
            prev[i][j] = best_prev

    # Backtrack
    i, j = n, m
    ops = []
    while i > 0 or j > 0:
        step = prev[i][j]
        if step is None:
            if i > 0:
                ops.append(("DEL", i - 1, None))
                i -= 1
            elif j > 0:
                ops.append(("INS", None, j - 1))
                j -= 1
            continue

        op, gi, tj = step
        ops.append(step)
        if op == "MATCH":
            i -= 1
            j -= 1
        elif op == "DEL":
            i -= 1
        else:
            j -= 1

    ops.reverse()
    return ops


def _build_insights(gold_list, mismatched_details, timestamp_within_tolerance_count=0, matched_events=0, alignment_rows=None):
    attribute_error_counts = {}
    half_error_counts = {"FHN": 0, "SHN": 0, "OTHER": 0}
    player_error_counts = {}
    timestamp_error_count = 0

    passing_total = 0
    non_passing_total = 0
    passing_mismatch_count = 0
    non_passing_mismatch_count = 0
    key_action_totals = {f"{a}-{n}": 0 for a, n in KEY_ACTION_NOTES}
    key_action_mismatches = {f"{a}-{n}": 0 for a, n in KEY_ACTION_NOTES}
    key_action_error_details = {f"{a}-{n}": [] for a, n in KEY_ACTION_NOTES}

    for raw in gold_list:
        parsed = _safe_parse(raw)
        if not parsed:
            continue
        action = parsed.get("action", "")
        note = str(parsed.get("attribute", ""))
        if action in PASSING_ACTIONS:
            passing_total += 1
        else:
            non_passing_total += 1
        key_id = f"{action}-{note}"
        if key_id in key_action_totals:
            key_action_totals[key_id] += 1

    parsed_mismatches = []
    max_minute = 0

    for item in mismatched_details:
        parsed_gold = _safe_parse(item.get("gold", ""))
        errors = item.get("errors", {})
        minute = None

        if parsed_gold:
            try:
                h, m, s = map(int, str(parsed_gold.get("timestamp", "0:00:00")).split(":"))
                minute = h * 60 + m + (s / 60.0)
                if minute > max_minute:
                    max_minute = minute
            except Exception:
                minute = None

        if "timestamp" in errors:
            timestamp_error_count += 1

        if not parsed_gold:
            parsed_mismatches.append({"parsed": None, "errors": errors, "minute": minute})
            continue

        action = parsed_gold.get("action", "")
        note = str(parsed_gold.get("attribute", ""))
        attribute_error_counts[action] = attribute_error_counts.get(action, 0) + 1
        key_id = f"{action}-{note}"

        if action in PASSING_ACTIONS:
            passing_mismatch_count += 1
        else:
            non_passing_mismatch_count += 1

        half = parsed_gold.get("half_notation", "")
        if half in {"FHN", "SHN"}:
            half_error_counts[half] += 1
        else:
            half_error_counts["OTHER"] += 1

        player = f"{parsed_gold.get('team', '?')}-{parsed_gold.get('jersey_number', '?')}"
        player_error_counts[player] = player_error_counts.get(player, 0) + 1
        parsed_mismatches.append({"parsed": parsed_gold, "errors": errors, "minute": minute})

    # Key-action mismatch logic is independent from main mismatch logic:
    # if key action-note matches between gold and trainee, do not count it as key mismatch.
    key_ids = set(key_action_totals.keys())
    for row in (alignment_rows or []):
        status = row.get("status")
        gold_raw = row.get("gold")
        trainee_raw = row.get("trainee")

        parsed_gold = _safe_parse(gold_raw) if gold_raw else None
        if not parsed_gold:
            continue

        gold_key = f"{parsed_gold.get('action', '')}-{str(parsed_gold.get('attribute', ''))}"
        if gold_key not in key_ids:
            continue

        if status == "missed":
            key_action_mismatches[gold_key] += 1
            key_action_error_details[gold_key].append(
                {"gold": gold_raw or "", "trainee": trainee_raw or "", "errors": row.get("errors", {})}
            )
            continue

        if status != "mismatch":
            continue

        parsed_trainee = _safe_parse(trainee_raw) if trainee_raw else None
        trainee_key = None
        if parsed_trainee:
            trainee_key = f"{parsed_trainee.get('action', '')}-{str(parsed_trainee.get('attribute', ''))}"

        if trainee_key != gold_key:
            key_action_mismatches[gold_key] += 1
            key_action_error_details[gold_key].append(
                {"gold": gold_raw or "", "trainee": trainee_raw or "", "errors": row.get("errors", {})}
            )

    mismatch_count = len(mismatched_details)
    timestamp_pct = round((timestamp_error_count / mismatch_count) * 100, 2) if mismatch_count else 0.0
    timestamp_common = timestamp_pct >= 30.0

    passing_rate = round((passing_mismatch_count / passing_total) * 100, 2) if passing_total else 0.0
    non_passing_rate = round((non_passing_mismatch_count / non_passing_total) * 100, 2) if non_passing_total else 0.0
    passing_more_error_prone = passing_rate > non_passing_rate if (passing_total and non_passing_total) else None

    if attribute_error_counts:
        most_error_attr = max(attribute_error_counts.items(), key=lambda kv: kv[1])
        most_error_attribute = {"attribute": most_error_attr[0], "count": most_error_attr[1]}
    else:
        most_error_attribute = {"attribute": None, "count": 0}

    worst_half = max(half_error_counts.items(), key=lambda kv: kv[1])[0] if mismatch_count else None

    top_players = sorted(player_error_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_players_wrong = [{"player": p, "errors": c} for p, c in top_players]
    key_action_profile = []
    key_action_sections = []
    for section in KEY_ACTION_SECTIONS:
        rows = []
        for action, note in section["items"]:
            key_id = f"{action}-{note}"
            total = key_action_totals.get(key_id, 0)
            mism = key_action_mismatches.get(key_id, 0)
            rate = round((mism / total) * 100, 2) if total else 0.0
            row = {
                "key": key_id,
                "label": f"{ACTION_DISPLAY_NAMES.get(action, action)} {note}",
                "total": total,
                "mismatches": mism,
                "error_rate": rate,
            }
            rows.append(row)
            key_action_profile.append(row)

        key_action_sections.append(
            {
                "id": section["id"],
                "title": section["title"],
                "rows": rows,
            }
        )

    # Trend bins for sparkline visuals.
    bin_count = 8
    max_for_bins = max(max_minute, 1)
    bin_size = max_for_bins / bin_count

    attr_trend = [0] * bin_count
    timestamp_trend = [0] * bin_count
    passing_trend = [0] * bin_count
    half_trend = [0] * bin_count

    top_attr_name = most_error_attribute["attribute"]

    for row in parsed_mismatches:
        minute = row.get("minute")
        if minute is None:
            bin_index = 0
        else:
            bin_index = min(bin_count - 1, int(minute / bin_size)) if bin_size > 0 else 0

        parsed = row.get("parsed")
        errors = row.get("errors", {})

        if "timestamp" in errors:
            timestamp_trend[bin_index] += 1

        if not parsed:
            continue

        action = parsed.get("action", "")
        if action in PASSING_ACTIONS:
            passing_trend[bin_index] += 1

        half = parsed.get("half_notation", "")
        if half == worst_half and worst_half is not None:
            half_trend[bin_index] += 1

        if top_attr_name and action == top_attr_name:
            attr_trend[bin_index] += 1

    return {
        "most_error_attribute": most_error_attribute,
        "timestamp_deviation": {
            "count": timestamp_error_count,
            "percentage": timestamp_pct,
            "is_common": timestamp_common,
            "within_tolerance_count": timestamp_within_tolerance_count,
            "within_tolerance_percentage": round((timestamp_within_tolerance_count / matched_events) * 100, 2)
            if matched_events
            else 0.0,
        },
        "passing_error_prone": {
            "passing_error_rate": passing_rate,
            "non_passing_error_rate": non_passing_rate,
            "is_more_error_prone": passing_more_error_prone,
        },
        "half_mistakes": {
            "FHN": half_error_counts["FHN"],
            "SHN": half_error_counts["SHN"],
            "OTHER": half_error_counts["OTHER"],
            "worst_half": worst_half,
        },
        "top_players_wrong": top_players_wrong,
        "key_action_profile": key_action_profile,
        "key_action_sections": key_action_sections,
        "key_action_error_details": key_action_error_details,
        "trends": {
            "attribute": attr_trend,
            "timestamp": timestamp_trend,
            "passing": passing_trend,
            "half": half_trend,
        },
    }


def evaluate_match(gold_list, trainee_list, time_tolerance=2000):
    gold_list = [x.strip().strip(",") for x in gold_list if x.strip()]
    trainee_list = [x.strip().strip(",") for x in trainee_list if x.strip()]

    gold_attribute_counts, gold_skipped = _build_attribute_counts(gold_list, strict_validation=False)
    trainee_attribute_counts, trainee_skipped = _build_attribute_counts(trainee_list, strict_validation=False)
    trainee_attribute_counts_valid, trainee_skipped_valid = _build_attribute_counts(trainee_list, strict_validation=True)
    attribute_note_breakdown = _build_attribute_note_breakdown(gold_list, trainee_list)
    attribute_team_breakdown = _build_attribute_team_breakdown(gold_list, trainee_list)
    attribute_team_note_breakdown = _build_attribute_team_note_breakdown(gold_list, trainee_list)

    correct_count = 0
    matched_events = 0
    timestamp_within_tolerance_count = 0
    missed_strings, extra_strings, mismatched_details = [], [], []
    alignment_rows = []
    field_errors = {}

    ops = _align_sequences(gold_list, trainee_list, time_tolerance)

    for op, gi, tj in ops:
        if op == "DEL":
            missed_strings.append(gold_list[gi])
            alignment_rows.append({
                "status": "missed",
                "gold": gold_list[gi],
                "trainee": None,
                "errors": {"missing_in_trainee": {"expected": gold_list[gi], "predicted": "(missing)"}},
            })
            continue
        if op == "INS":
            extra_strings.append(trainee_list[tj])
            alignment_rows.append({
                "status": "extra",
                "gold": None,
                "trainee": trainee_list[tj],
                "errors": {"extra_in_trainee": {"expected": "(none)", "predicted": trainee_list[tj]}},
            })
            continue

        try:
            _, errors, warnings = _compare_with_meta(gold_list[gi], trainee_list[tj], time_tolerance)
        except Exception:
            errors = {"rule_internal": {"expected": "comparable strings", "predicted": "comparison failure"}}
            warnings = {}

        if not errors:
            correct_count += 1
            matched_events += 1
            if "timestamp_within_tolerance" in warnings:
                timestamp_within_tolerance_count += 1
            alignment_rows.append({
                "status": "matched",
                "gold": gold_list[gi],
                "trainee": trainee_list[tj],
                "errors": {},
                "warnings": warnings,
            })
        else:
            mismatched_details.append({"gold": gold_list[gi], "trainee": trainee_list[tj], "errors": errors})
            alignment_rows.append({
                "status": "mismatch",
                "gold": gold_list[gi],
                "trainee": trainee_list[tj],
                "errors": errors,
            })
            for field in errors:
                field_errors[field] = field_errors.get(field, 0) + 1

    total_gold = len(gold_list)
    attribute_labels = list(ACTION_RULES.keys())
    attribute_comparison = {
        "labels": attribute_labels,
        "gold_values": [gold_attribute_counts[a] for a in attribute_labels],
        "trainee_values": [trainee_attribute_counts[a] for a in attribute_labels],
    }
    insights = _build_insights(
        gold_list,
        mismatched_details,
        timestamp_within_tolerance_count=timestamp_within_tolerance_count,
        matched_events=matched_events,
        alignment_rows=alignment_rows,
    )

    return {
        "total_gold": total_gold,
        "total_trainee": len(trainee_list),
        "correct": correct_count,
        "missed_count": len(missed_strings),
        "extra_count": len(extra_strings),
        "mismatch_count": len(mismatched_details),
        "mismatched_details": mismatched_details,
        "alignment_rows": alignment_rows,
        "field_errors": field_errors,
        "gold_attribute_counts": gold_attribute_counts,
        "trainee_attribute_counts": trainee_attribute_counts,
        "trainee_attribute_counts_valid": trainee_attribute_counts_valid,
        "attribute_comparison": attribute_comparison,
        "attribute_note_breakdown": attribute_note_breakdown,
        "attribute_team_breakdown": attribute_team_breakdown,
        "attribute_team_note_breakdown": attribute_team_note_breakdown,
        "attribute_display_names": ACTION_DISPLAY_NAMES,
        "insights": insights,
        "timestamp_within_tolerance_count": timestamp_within_tolerance_count,
        "gold_count_skipped": gold_skipped,
        "trainee_count_skipped": trainee_skipped,
        "trainee_count_skipped_valid": trainee_skipped_valid,
        "overall_accuracy": round((correct_count / total_gold * 100), 2) if total_gold > 0 else 0,
    }
