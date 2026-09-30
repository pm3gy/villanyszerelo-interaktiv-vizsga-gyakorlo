import csv
import re
import unittest
from collections import Counter, defaultdict
from pathlib import Path


BANK_DIR = Path(__file__).resolve().parents[1]
QUESTION_ID_RE = re.compile(r"^Q[1-9]\d*$")
PADDED_QUESTION_ID_RE = re.compile(r"^Q0+\d+$")
CHOICE_ID_RE = re.compile(r"^C[1-9]\d*$")
PADDED_CHOICE_ID_RE = re.compile(r"^C0+\d+$")
ASSET_ID_RE = re.compile(r"^A[1-9]\d*$")
PADDED_ASSET_ID_RE = re.compile(r"^A0+\d+$")
SOURCE_ID_RE = re.compile(r"^S[1-9]\d*$")
PADDED_SOURCE_ID_RE = re.compile(r"^S0+\d+$")
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
        cls.sources = read_csv("sources.csv")

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

    def test_choice_and_asset_ids_are_unpadded(self):
        choice_ids = []
        for row in self.choices:
            choice_id = row["choice_id"]
            self.assertRegex(choice_id, CHOICE_ID_RE)
            self.assertNotRegex(choice_id, PADDED_CHOICE_ID_RE)
            choice_ids.append(choice_id)

        asset_ids = []
        for row in self.assets:
            asset_id = row["asset_id"]
            self.assertRegex(asset_id, ASSET_ID_RE)
            self.assertNotRegex(asset_id, PADDED_ASSET_ID_RE)
            asset_ids.append(asset_id)

        self.assertEqual(len(choice_ids), len(set(choice_ids)))
        self.assertEqual(len(asset_ids), len(set(asset_ids)))

    def test_source_ids_are_unpadded_and_references_are_valid(self):
        source_ids = []
        for row in self.sources:
            source_id = row["source_id"]
            self.assertRegex(source_id, SOURCE_ID_RE)
            self.assertNotRegex(source_id, PADDED_SOURCE_ID_RE)
            source_ids.append(source_id)

        self.assertEqual(len(source_ids), len(set(source_ids)))
        source_id_set = set(source_ids)

        for row in self.questions:
            source_id = row["source_id"]
            if source_id:
                self.assertIn(source_id, source_id_set, row["question_id"])
                self.assertNotRegex(source_id, PADDED_SOURCE_ID_RE)

        for row in self.assets:
            source_id = row["source_id"]
            if source_id:
                self.assertIn(source_id, source_id_set, row["asset_id"])
                self.assertNotRegex(source_id, PADDED_SOURCE_ID_RE)

    def test_szakma_kivalo_tanuloja_sources_use_unified_titles(self):
        normalized_ids = {
            "S4",
            "S5",
            "S20",
            "S21",
            "S22",
            "S23",
            "S24",
            "S25",
            "S26",
            "S27",
            "S28",
            "S29",
            "S30",
            "S37",
            "S38",
            "S39",
        }
        sources_by_id = {row["source_id"]: row for row in self.sources}

        for source_id in normalized_ids:
            row = sources_by_id[source_id]
            self.assertRegex(row["year"], r"^\d{4}$", source_id)
            self.assertEqual(
                row["title"],
                f"Szakma Kiváló Tanulója Verseny {row['year']}",
                source_id,
            )

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
                self.assertNotRegex(match_choice_id, PADDED_CHOICE_ID_RE)

    def test_structured_questions_do_not_store_display_labels(self):
        question_types = {row["question_id"]: row["question_type"] for row in self.questions}
        for row in self.choices:
            if question_types[row["question_id"]] in {"ordering", "matching", "grouping"}:
                self.assertEqual(row["choice_label"], "", row["choice_id"])

    def test_reported_question_corrections(self):
        questions_by_id = {row["question_id"]: row for row in self.questions}
        choices_by_question = defaultdict(list)
        for row in self.choices:
            choices_by_question[row["question_id"]].append(row)

        for question_id in ("Q82", "Q102"):
            rod_question = questions_by_id[question_id]
            for operand in ("R1 = 12 Ω", "R2 = 15 Ω", "R3 = 18 Ω"):
                self.assertIn(operand, rod_question["prompt_md"])
            self.assertEqual(rod_question["correct_answer_md"], "4.86")
            self.assertEqual(rod_question["source_id"], "S28")

        ip20_correct = [
            row["choice_text_md"]
            for row in choices_by_question["Q89"]
            if row["is_correct"].strip().lower() == "true"
        ]
        self.assertEqual(ip20_correct, ["Igaz."])

        q5_correct = [
            row["choice_text_md"]
            for row in choices_by_question["Q5"]
            if row["is_correct"].strip().lower() == "true"
        ]
        self.assertEqual(q5_correct, ["420V AC"])

        q486_correct = [
            row["choice_text_md"]
            for row in choices_by_question["Q486"]
            if row["is_correct"].strip().lower() == "true"
        ]
        self.assertEqual(q486_correct, ["24 V AC", "100 V DC"])

        q55_correct = [
            row["choice_text_md"]
            for row in choices_by_question["Q55"]
            if row["is_correct"].strip().lower() == "true"
        ]
        self.assertEqual(q55_correct, ["Mü III."])

    def test_results_review_heading_includes_stable_question_id(self):
        app_js = (BANK_DIR.parent / "vizsga-mvp" / "app.js").read_text(encoding="utf-8")
        render_results = app_js.split("function renderResults()", 1)[1].split(
            "function getResultScoreTone", 1
        )[0]
        self.assertIn("ID ${item.question.question_id}", render_results)


if __name__ == "__main__":
    unittest.main()
