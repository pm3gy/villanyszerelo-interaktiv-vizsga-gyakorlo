#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
import shutil
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
QUESTIONS_CSV = BASE / "questions.csv"
CHOICES_CSV = BASE / "choices.csv"
SOURCES_CSV = BASE / "sources.csv"
ASSETS_CSV = BASE / "assets.csv"

QUESTION_TYPES = [
    "single_choice",
    "multi_choice",
    "true_false",
    "list_choice",
    "ordering",
    "matching",
    "grouping",
    "numeric_entry",
]

QUESTION_FIELDS = [
    "question_id",
    "question_type",
    "prompt_md",
    "explanation_md",
    "topic",
    "subtopic",
    "difficulty",
    "points",
    "time_estimate_sec",
    "source_id",
    "source_locator",
    "tags",
    "language",
    "correct_answer_md",
    "answer_tolerance",
]

CHOICE_FIELDS = [
    "choice_id",
    "question_id",
    "choice_label",
    "choice_text_md",
    "is_correct",
    "sort_order",
    "feedback_md",
    "match_role",
    "match_choice_id",
    "group_label",
]

SOURCE_FIELDS = ["source_id", "title", "path", "source_type", "year", "category", "notes"]

ASSET_FIELDS = ["asset_id", "question_id", "path", "kind", "alt_text", "source_id", "source_locator"]


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh, delimiter=";"))


def write_csv(path: Path, fieldnames, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def next_id(prefix: str, existing_ids: list[str]) -> str:
    max_num = 0
    for value in existing_ids:
        if not value.startswith(prefix):
            continue
        match = re.search(r"(\d+)$", value)
        if match:
            max_num = max(max_num, int(match.group(1)))
    width = max(4, len(str(max_num + 1)))
    return f"{prefix}{max_num + 1:0{width}d}"


def alpha_label(index: int) -> str:
    index += 1
    letters = []
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default not in (None, "") else ""
    value = input(f"{prompt}{suffix}: ").strip()
    if value:
        return value
    return "" if default is None else default


def ask_multiline(prompt: str) -> str:
    print(prompt)
    print("Enter `END` on its own line to finish.")
    lines = []
    while True:
        line = input("> ")
        if line.strip() == "END":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def choose_from_list(title: str, options: list[str], default_index: int = 0) -> str:
    print(title)
    for idx, option in enumerate(options, start=1):
        print(f"  {idx}. {option}")
    while True:
        raw = ask("Choose by number or type a value", str(default_index + 1))
        if raw.isdigit():
            idx = int(raw)
            if 1 <= idx <= len(options):
                return options[idx - 1]
        if raw:
            return raw


def load_sources():
    return read_csv(SOURCES_CSV)


def source_display(source: dict[str, str]) -> str:
    title = source.get("title") or source.get("path") or source.get("source_id")
    return f'{source.get("source_id")}  |  {title}'


def topic_display(topic: str) -> str:
    return topic or "(üres)"


def parse_marked_lines(text: str):
    items = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        is_correct = False
        for prefix in ("*", "!", "+"):
            if line.startswith(prefix):
                is_correct = True
                line = line[len(prefix):].strip()
                break
        items.append((line, is_correct))
    return items


def parse_pairs(text: str):
    pairs = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if "|" in line:
            left, right = [part.strip() for part in line.split("|", 1)]
        elif "=>" in line:
            left, right = [part.strip() for part in line.split("=>", 1)]
        elif "=" in line:
            left, right = [part.strip() for part in line.split("=", 1)]
        else:
            raise ValueError(f"Bad pair line: {line}")
        pairs.append((left, right))
    return pairs


def normalize_asset_path(raw_path: str) -> str:
    path = raw_path.strip()
    if not path:
        return ""
    if path.startswith("../kerdesbank/") or path.startswith("media/"):
        return path if path.startswith("../kerdesbank/") else f"../kerdesbank/{path}"
    if path.startswith("kerdesbank/"):
        return f"../{path}"
    return f"../kerdesbank/media/{Path(path).name}"


def store_asset_path(raw_path: str) -> str:
    candidate = Path(raw_path).expanduser()
    if candidate.exists() and candidate.is_file():
        media_dir = BASE / "media"
        media_dir.mkdir(parents=True, exist_ok=True)
        destination = media_dir / candidate.name
        if destination.exists():
            suffix = 1
            while True:
                renamed = media_dir / f"{candidate.stem}_{suffix}{candidate.suffix}"
                if not renamed.exists():
                    destination = renamed
                    break
                suffix += 1
        shutil.copy2(candidate, destination)
        return f"../kerdesbank/media/{destination.name}"
    return normalize_asset_path(raw_path)


def build_choice_rows(question_id: str, question_type: str, choice_id_start: str, entries, kind: str):
    rows = []
    current_num = int(re.search(r"(\d+)$", choice_id_start).group(1))

    def next_choice_id():
        nonlocal current_num
        choice_id = f"C{current_num:04d}"
        current_num += 1
        return choice_id

    if question_type in {"single_choice", "multi_choice", "list_choice"}:
        for index, (text, is_correct) in enumerate(entries):
            rows.append({
                "choice_id": next_choice_id(),
                "question_id": question_id,
                "choice_label": alpha_label(index),
                "choice_text_md": text,
                "is_correct": "true" if is_correct else "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "",
                "match_choice_id": "",
                "group_label": "",
            })
        return rows

    if question_type == "true_false":
        if len(entries) != 1:
            raise ValueError("A true/false kérdéshez pontosan egy állítást adj meg.")
        statement, is_true = entries[0]
        true_text = "Igaz"
        false_text = "Hamis"
        correct_first = bool(is_true)
        options = [
            (true_text, correct_first),
            (false_text, not correct_first),
        ]
        for index, (text, is_correct) in enumerate(options):
            rows.append({
                "choice_id": next_choice_id(),
                "question_id": question_id,
                "choice_label": alpha_label(index),
                "choice_text_md": text,
                "is_correct": "true" if is_correct else "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "",
                "match_choice_id": "",
                "group_label": "",
            })
        return rows

    if question_type == "ordering":
        for index, text in enumerate(entries):
            rows.append({
                "choice_id": next_choice_id(),
                "question_id": question_id,
                "choice_label": alpha_label(index),
                "choice_text_md": text,
                "is_correct": "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "",
                "match_choice_id": "",
                "group_label": "",
            })
        return rows

    if question_type == "matching":
        right_rows = []
        left_rows = []
        right_ids = []
        for index, (left_text, right_text) in enumerate(entries):
            right_choice_id = next_choice_id()
            right_ids.append(right_choice_id)
            right_rows.append({
                "choice_id": right_choice_id,
                "question_id": question_id,
                "choice_label": str(index + 1),
                "choice_text_md": right_text,
                "is_correct": "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "right",
                "match_choice_id": "",
                "group_label": "",
            })
        for index, (left_text, _right_text) in enumerate(entries):
            left_rows.append({
                "choice_id": next_choice_id(),
                "question_id": question_id,
                "choice_label": alpha_label(index),
                "choice_text_md": left_text,
                "is_correct": "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "left",
                "match_choice_id": right_ids[index],
                "group_label": "",
            })
        return left_rows + right_rows

    if question_type == "grouping":
        for index, (item_text, group_label) in enumerate(entries):
            rows.append({
                "choice_id": next_choice_id(),
                "question_id": question_id,
                "choice_label": alpha_label(index),
                "choice_text_md": item_text,
                "is_correct": "false",
                "sort_order": str(index + 1),
                "feedback_md": "",
                "match_role": "",
                "match_choice_id": "",
                "group_label": group_label,
            })
        return rows

    raise ValueError(f"Unsupported question type: {question_type}")


def choose_question_type() -> str:
    print("Question type options:")
    for idx, item in enumerate(QUESTION_TYPES, start=1):
        print(f"  {idx}. {item}")
    while True:
        raw = ask("Choose question type", "1")
        if raw.isdigit():
            idx = int(raw)
            if 1 <= idx <= len(QUESTION_TYPES):
                return QUESTION_TYPES[idx - 1]
        if raw in QUESTION_TYPES:
            return raw


def choose_topic(topics: list[str]) -> str:
    topics = sorted(set(topic for topic in topics if topic))
    options = topics[:]
    if options:
        print("Known topics:")
        for idx, item in enumerate(options, start=1):
            print(f"  {idx}. {item}")
    raw = ask("Topic (number or new text)", options[0] if options else "vezetékek")
    if raw.isdigit() and 1 <= int(raw) <= len(options):
        return options[int(raw) - 1]
    return raw


def choose_source(sources: list[dict[str, str]]):
    print("Sources:")
    for idx, source in enumerate(sources, start=1):
        print(f"  {idx}. {source_display(source)}")
    print("  0. New source")
    while True:
        raw = ask("Source number or source id", "1")
        if raw == "0":
            source_id = next_id("S", [row["source_id"] for row in sources])
            title = ask("Source title")
            path = ask("Source path (repo-relative)")
            source_type = ask("Source type", "pdf")
            year = ask("Year (optional)")
            category = ask("Category", "vizsga")
            notes = ask("Notes (optional)")
            new_source = {
                "source_id": source_id,
                "title": title,
                "path": path,
                "source_type": source_type,
                "year": year,
                "category": category,
                "notes": notes,
            }
            return new_source, True
        if raw.isdigit():
            idx = int(raw)
            if 1 <= idx <= len(sources):
                return sources[idx - 1], False
        match = next((source for source in sources if source["source_id"] == raw), None)
        if match:
            return match, False


def preview(question_row: dict[str, str], choice_rows: list[dict[str, str]], asset_rows: list[dict[str, str]], source_row: dict[str, str] | None):
    print("\nPreview")
    print("-" * 72)
    print(f"{question_row['question_id']} | {question_row['question_type']} | {question_row['topic']} / {question_row['subtopic']}")
    print(question_row["prompt_md"])
    print(f"Source: {source_row['source_id']} - {source_row['title'] if source_row else question_row['source_id']}")
    print(f"Locator: {question_row['source_locator']}")
    if question_row["question_type"] == "numeric_entry":
        print(f"Numeric answer: {question_row['correct_answer_md']} ± {question_row['answer_tolerance']}")
    for row in choice_rows:
        extra = []
        if row["match_role"]:
            extra.append(f"match_role={row['match_role']}")
        if row["match_choice_id"]:
            extra.append(f"match_choice_id={row['match_choice_id']}")
        if row["group_label"]:
            extra.append(f"group={row['group_label']}")
        flags = f" ({', '.join(extra)})" if extra else ""
        print(f"  {row['choice_label']}. {row['choice_text_md']}{flags}")
    for row in asset_rows:
        print(f"  asset: {row['path']} [{row['kind']}]")
    print("-" * 72)


def main():
    questions = read_csv(QUESTIONS_CSV)
    choices = read_csv(CHOICES_CSV)
    sources = read_csv(SOURCES_CSV)
    assets = read_csv(ASSETS_CSV)

    question_id = next_id("Q", [row["question_id"] for row in questions])
    choice_id_start = next_id("C", [row["choice_id"] for row in choices])
    asset_id_start = next_id("A", [row["asset_id"] for row in assets])

    question_type = choose_question_type()
    topics = [row.get("topic", "") for row in questions]
    topic = choose_topic(topics)
    subtopic = ask("Subtopic (optional)", "")
    difficulty = ask("Difficulty 1-5", "2")
    points = ask("Points", "1")
    time_estimate_sec = ask("Time estimate sec", "20")
    source_row, source_is_new = choose_source(sources)
    source_locator = ask("Source locator")
    tags = ask("Tags (comma-separated, optional)", "")
    language = ask("Language", "hu")
    prompt_md = ask_multiline("Question text")
    if not prompt_md:
        print("No question text provided.")
        return

    explanation_md = ask_multiline("Explanation (optional)")
    choice_rows = []
    question_extra = {"correct_answer_md": "", "answer_tolerance": ""}
    asset_rows = []

    if question_type in {"single_choice", "multi_choice", "list_choice"}:
        raw_options = ask_multiline("Answer options, one per line. Prefix correct ones with *")
        entries = parse_marked_lines(raw_options)
        if len(entries) < 2:
            raise SystemExit("At least two answer options are required.")
        correct_count = sum(1 for _text, is_correct in entries if is_correct)
        if question_type == "single_choice" and correct_count != 1:
            raise SystemExit("single_choice needs exactly one marked correct option.")
        if question_type == "multi_choice" and correct_count < 1:
            raise SystemExit("multi_choice needs at least one marked correct option.")
        if question_type == "list_choice" and correct_count != 1:
            raise SystemExit("list_choice needs exactly one marked correct option.")
        choice_rows = build_choice_rows(question_id, question_type, choice_id_start, entries, "choices")
    elif question_type == "true_false":
        is_true = ask("Is the statement true? [y/N]", "n").lower().startswith("y")
        choice_rows = build_choice_rows(question_id, question_type, choice_id_start, [(prompt_md, is_true)], "choices")
    elif question_type == "ordering":
        raw_items = ask_multiline("Items in the correct order, one per line")
        items = [line.strip() for line in raw_items.splitlines() if line.strip()]
        if len(items) < 2:
            raise SystemExit("ordering needs at least two items.")
        choice_rows = build_choice_rows(question_id, question_type, choice_id_start, items, "choices")
    elif question_type == "matching":
        raw_pairs = ask_multiline("Pairs as left | right, one per line")
        pairs = parse_pairs(raw_pairs)
        if len(pairs) < 2:
            raise SystemExit("matching needs at least two pairs.")
        choice_rows = build_choice_rows(question_id, question_type, choice_id_start, pairs, "choices")
    elif question_type == "grouping":
        raw_items = ask_multiline("Items as item | group, one per line")
        pairs = parse_pairs(raw_items)
        if len(pairs) < 2:
            raise SystemExit("grouping needs at least two items.")
        choice_rows = build_choice_rows(question_id, question_type, choice_id_start, pairs, "choices")
    elif question_type == "numeric_entry":
        correct_answer_md = ask("Correct answer")
        answer_tolerance = ask("Tolerance", "0")
        question_extra["correct_answer_md"] = correct_answer_md
        question_extra["answer_tolerance"] = answer_tolerance
    else:
        raise SystemExit(f"Unsupported question type: {question_type}")

    asset_input = ask("Asset paths (comma-separated, optional)", "")
    if asset_input.strip():
        asset_paths = [item.strip() for item in asset_input.split(",") if item.strip()]
        alt_text = ask("Asset alt text (optional)", "")
        kind = ask("Asset kind", "image")
        asset_num = int(re.search(r"(\d+)$", asset_id_start).group(1))
        for index, raw_path in enumerate(asset_paths):
            asset_id = f"A{asset_num:04d}"
            asset_num += 1
            asset_rows.append({
                "asset_id": asset_id,
                "question_id": question_id,
                "path": store_asset_path(raw_path),
                "kind": kind,
                "alt_text": alt_text or Path(raw_path.strip()).name,
                "source_id": source_row["source_id"],
                "source_locator": source_locator,
            })

    question_row = {
        "question_id": question_id,
        "question_type": question_type,
        "prompt_md": prompt_md,
        "explanation_md": explanation_md,
        "topic": topic,
        "subtopic": subtopic,
        "difficulty": difficulty,
        "points": points,
        "time_estimate_sec": time_estimate_sec,
        "source_id": source_row["source_id"],
        "source_locator": source_locator,
        "tags": tags,
        "language": language,
        "correct_answer_md": question_extra["correct_answer_md"],
        "answer_tolerance": question_extra["answer_tolerance"],
    }

    preview(question_row, choice_rows, asset_rows, source_row)
    confirm = ask("Write to CSV files? [y/N]", "n").lower()
    if not confirm.startswith("y"):
        print("Aborted.")
        return

    if source_is_new:
        sources.append(source_row)
        write_csv(SOURCES_CSV, SOURCE_FIELDS, sources)

    questions.append(question_row)
    choices.extend(choice_rows)
    assets.extend(asset_rows)

    write_csv(QUESTIONS_CSV, QUESTION_FIELDS, questions)
    write_csv(CHOICES_CSV, CHOICE_FIELDS, choices)
    write_csv(ASSETS_CSV, ASSET_FIELDS, assets)

    print(f"Added {question_id} with {len(choice_rows)} choice rows and {len(asset_rows)} asset rows.")


if __name__ == "__main__":
    main()
