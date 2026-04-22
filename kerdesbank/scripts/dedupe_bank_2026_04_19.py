from __future__ import annotations

import csv
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh, delimiter=";"))


def write_csv(path: Path, fieldnames, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def question_key(row: dict[str, str]) -> tuple[str, ...]:
    return (
        row["question_type"],
        row["prompt_md"],
        row["explanation_md"],
        row["topic"],
        row["subtopic"],
        row["difficulty"],
        row["points"],
        row["time_estimate_sec"],
        row["source_id"],
        row["source_locator"],
        row["tags"],
        row["language"],
        row["correct_answer_md"],
        row["answer_tolerance"],
    )


def main() -> None:
    questions = read_csv(BASE / "questions.csv")
    choices = read_csv(BASE / "choices.csv")

    kept_questions = []
    seen_questions: set[tuple[str, ...]] = set()
    kept_question_ids: set[str] = set()

    for row in questions:
        key = question_key(row)
        if key in seen_questions:
            continue
        seen_questions.add(key)
        kept_questions.append(row)
        kept_question_ids.add(row["question_id"])

    kept_choices = [row for row in choices if row["question_id"] in kept_question_ids]

    q_fields = list(questions[0].keys()) if questions else []
    c_fields = list(choices[0].keys()) if choices else []
    write_csv(BASE / "questions.csv", q_fields, kept_questions)
    write_csv(BASE / "choices.csv", c_fields, kept_choices)

    print(f"questions: {len(questions)} -> {len(kept_questions)}")
    print(f"choices: {len(choices)} -> {len(kept_choices)}")


if __name__ == "__main__":
    main()
