import csv
import re
import unittest
from collections import Counter, defaultdict
from pathlib import Path


BANK_DIR = Path(__file__).resolve().parents[1]
QUESTION_ID_RE = re.compile(r"^Q[1-9]\d*$")
PADDED_QUESTION_ID_RE = re.compile(r"^Q0+\d+$")
SUPPORTED_TYPES = {
    "single_choice",
    "multi_choice",
    "true_false",
    "list_choice",
    "ordering",
    "matching",
    "grouping",
    "numeric_entry",
}


def read_csv(name):
    with (BANK_DIR / name).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=";"))


class QuestionBankTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.questions = read_csv("questions.csv")
        cls.choices = read_csv("choices.csv")
        cls.assets = read_csv("assets.csv")

    def test_question_ids_are_unpadded_and_ordered(self):
        seen_numbers = []
        for row in self.questions:
            question_id = row["question_id"]
            self.assertRegex(question_id, QUESTION_ID_RE)
            self.assertNotRegex(question_id, PADDED_QUESTION_ID_RE)
            seen_numbers.append(int(question_id[1:]))

        self.assertEqual(len(seen_numbers), len(set(seen_numbers)))
        self.assertEqual(seen_numbers, sorted(seen_numbers))

    def test_question_references_are_valid_and_unpadded(self):
        question_ids = {row["question_id"] for row in self.questions}

        for row in self.choices:
            self.assertIn(row["question_id"], question_ids)
            self.assertNotRegex(row["question_id"], PADDED_QUESTION_ID_RE)

        for row in self.assets:
            self.assertIn(row["question_id"], question_ids)
            self.assertNotRegex(row["question_id"], PADDED_QUESTION_ID_RE)

    def test_choice_shape_matches_question_type(self):
        choices_by_question = defaultdict(list)
        for row in self.choices:
            choices_by_question[row["question_id"]].append(row)

        for question in self.questions:
            question_id = question["question_id"]
            question_type = question["question_type"]
            choices = choices_by_question[question_id]
            correct_count = Counter(row["is_correct"].strip().lower() for row in choices)["true"]

            self.assertIn(question_type, SUPPORTED_TYPES)

            if question_type == "numeric_entry":
                self.assertEqual(choices, [])
                self.assertTrue(question["correct_answer_md"])
            elif question_type in {"single_choice", "true_false", "list_choice"}:
                self.assertEqual(correct_count, 1, question_id)
            elif question_type == "multi_choice":
                self.assertGreaterEqual(correct_count, 1, question_id)
            else:
                self.assertGreater(len(choices), 0, question_id)

    def test_matching_choice_references_are_valid(self):
        choice_ids = {row["choice_id"] for row in self.choices}
        for row in self.choices:
            match_choice_id = row["match_choice_id"]
            if match_choice_id:
                self.assertIn(match_choice_id, choice_ids)

    def test_structured_questions_do_not_store_display_labels(self):
        question_types = {row["question_id"]: row["question_type"] for row in self.questions}
        for row in self.choices:
            if question_types[row["question_id"]] in {"ordering", "matching", "grouping"}:
                self.assertEqual(row["choice_label"], "", row["choice_id"])


if __name__ == "__main__":
    unittest.main()
