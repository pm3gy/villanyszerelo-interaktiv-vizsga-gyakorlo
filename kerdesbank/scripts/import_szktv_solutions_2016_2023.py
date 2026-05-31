from __future__ import annotations

import csv
import re
import zlib
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image


BANK_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BANK_DIR.parent
RESOURCE_DIR = REPO_DIR.parent / "szakma sztár feladatok"
MEDIA_DIR = BANK_DIR / "media"
YEARS = range(2016, 2024)
ACCEPTED_TASKS = {
    (2023, 2),
    (2023, 5),
    (2023, 6),
    (2023, 7),
    (2023, 9),
    (2023, 11),
    (2023, 13),
    (2023, 14),
    (2023, 15),
    (2023, 16),
    (2023, 17),
    (2023, 18),
    (2023, 20),
    (2023, 21),
    (2023, 22),
}

WHITES = {0, 9, 10, 12, 13, 32}
DELIMS = {9, 10, 12, 13, 32, 40, 41, 60, 62, 91, 93, 47}
IMAGE_HINT_RE = re.compile(r"\b(k[eé]p|k[eé]pen|[aá]bra|rajz)\b", re.I)


@dataclass
class PdfObj:
    raw: bytes
    stream: bytes | None
    dict_bytes: bytes


@dataclass
class TextChunk:
    text: str
    x: float
    y: float
    font: str


@dataclass
class Line:
    page: int
    y: float
    text: str
    fonts: set[str]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=";"))


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, delimiter=";", lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(rows)


def next_id(prefix: str, rows: list[dict[str, str]], field: str) -> int:
    nums = []
    for row in rows:
        value = row.get(field, "")
        if value.startswith(prefix):
            match = re.search(r"(\d+)$", value)
            if match:
                nums.append(int(match.group(1)))
    return max(nums, default=0) + 1


def normalize_key(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\wáéíóöőúüű]+", "", text)
    return text


def read_objects(data: bytes) -> dict[int, PdfObj]:
    objects: dict[int, PdfObj] = {}
    for match in re.finditer(rb"(\d+)\s+(\d+)\s+obj\b(.*?)endobj", data, re.S):
        obj_id = int(match.group(1))
        body = match.group(3)
        stream = None
        dict_bytes = b""
        stream_match = re.search(rb"<<(.*?)>>\s*stream\r?\n(.*?)endstream", body, re.S)
        if stream_match:
            dict_bytes = stream_match.group(1)
            stream = stream_match.group(2)
        else:
            dict_match = re.search(rb"<<(.*?)>>", body, re.S)
            if dict_match:
                dict_bytes = dict_match.group(1)
        objects[obj_id] = PdfObj(raw=body, stream=stream, dict_bytes=dict_bytes)
    return objects


def inflate(obj: PdfObj) -> bytes:
    data = obj.stream or b""
    if b"FlateDecode" in obj.raw:
        try:
            return zlib.decompress(data)
        except zlib.error:
            return data
    return data


def parse_page_ids(objects: dict[int, PdfObj]) -> list[int]:
    pages_id: int | None = None
    for obj_id, obj in objects.items():
        if re.search(rb"/Type\s*/Catalog", obj.raw):
            match = re.search(rb"/Pages\s+(\d+)\s+\d+\s+R", obj.raw)
            if match:
                pages_id = int(match.group(1))
                break
    if pages_id is None:
        for obj_id, obj in objects.items():
            if re.search(rb"/Type\s*/Pages", obj.raw):
                pages_id = obj_id
                break
    if pages_id is None or pages_id not in objects:
        return []
    match = re.search(rb"/Kids\s*\[(.*?)\]", objects[pages_id].raw, re.S)
    if not match:
        return []
    return [int(value) for value in re.findall(rb"(\d+)\s+\d+\s+R", match.group(1))]


def parse_font_resources(objects: dict[int, PdfObj], page_obj: PdfObj) -> dict[str, int]:
    font_match = re.search(rb"/Font\s*<<(.*?)>>", page_obj.raw, re.S)
    if font_match:
        body = font_match.group(1)
    else:
        ref_match = re.search(rb"/Font\s+(\d+)\s+\d+\s+R", page_obj.raw)
        if not ref_match:
            return {}
        body = objects.get(int(ref_match.group(1)), PdfObj(b"", None, b"")).raw
    return {
        name.decode("latin1"): int(obj_id)
        for name, obj_id in re.findall(rb"/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R", body)
    }


def unicode_from_hex(hex_value: str) -> str:
    raw = bytes.fromhex(hex_value)
    if len(raw) >= 2:
        try:
            return raw.decode("utf-16-be")
        except UnicodeDecodeError:
            pass
    return raw.decode("latin1", errors="replace")


def parse_to_unicode(objects: dict[int, PdfObj], font_obj: PdfObj) -> dict[int, str]:
    match = re.search(rb"/ToUnicode\s+(\d+)\s+\d+\s+R", font_obj.raw)
    if not match:
        return {}
    cmap_obj = objects.get(int(match.group(1)))
    if not cmap_obj or cmap_obj.stream is None:
        return {}
    cmap = inflate(cmap_obj).decode("latin1", errors="replace")
    mapping: dict[int, str] = {}
    for _, body in re.findall(r"(\d+)\s+beginbfchar\s*(.*?)endbfchar", cmap, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>", body):
            mapping[int(src, 16)] = unicode_from_hex(dst)
    for _, body in re.findall(r"(\d+)\s+beginbfrange\s*(.*?)endbfrange", cmap, re.S):
        for start, end, dst_start in re.findall(
            r"<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>",
            body,
        ):
            s_val = int(start, 16)
            e_val = int(end, 16)
            d_val = int(dst_start, 16)
            for value in range(s_val, e_val + 1):
                mapping[value] = unicode_from_hex(f"{d_val + value - s_val:04X}")
        for start, end, array in re.findall(
            r"<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[(.*?)\]",
            body,
            re.S,
        ):
            s_val = int(start, 16)
            e_val = int(end, 16)
            values = re.findall(r"<([0-9A-Fa-f]+)>", array)
            for idx, dst in enumerate(values):
                cid = s_val + idx
                if cid > e_val:
                    break
                mapping[cid] = unicode_from_hex(dst)
    return mapping


def parse_font_infos(objects: dict[int, PdfObj], fonts: dict[str, int]) -> dict[str, dict[str, Any]]:
    infos: dict[str, dict[str, Any]] = {}
    for name, obj_id in fonts.items():
        obj = objects.get(obj_id)
        if not obj:
            continue
        raw = obj.raw.decode("latin1", errors="replace")
        subtype = re.search(r"/Subtype\s*/([A-Za-z0-9_-]+)", raw)
        encoding = re.search(r"/Encoding\s*/([A-Za-z0-9_-]+)", raw)
        infos[name] = {
            "subtype": subtype.group(1) if subtype else "",
            "encoding": encoding.group(1) if encoding else "",
            "to_unicode": parse_to_unicode(objects, obj),
        }
    return infos


def decode_pdf_string(raw: bytes) -> bytes:
    out = bytearray()
    idx = 0
    while idx < len(raw):
        byte = raw[idx]
        if byte != 0x5C:
            out.append(byte)
            idx += 1
            continue
        idx += 1
        if idx >= len(raw):
            break
        esc = raw[idx]
        simple = {
            ord("n"): b"\n",
            ord("r"): b"\r",
            ord("t"): b"\t",
            ord("b"): b"\b",
            ord("f"): b"\f",
            ord("("): b"(",
            ord(")"): b")",
            ord("\\"): b"\\",
        }
        if esc in simple:
            out.extend(simple[esc])
            idx += 1
        elif 48 <= esc <= 55:
            value = esc - 48
            idx += 1
            for _ in range(2):
                if idx < len(raw) and 48 <= raw[idx] <= 55:
                    value = value * 8 + raw[idx] - 48
                    idx += 1
                else:
                    break
            out.append(value)
        elif esc in {10, 13}:
            if esc == 13 and idx + 1 < len(raw) and raw[idx + 1] == 10:
                idx += 2
            else:
                idx += 1
        else:
            out.append(esc)
            idx += 1
    return bytes(out)


def fix_identity_text(text: str) -> str:
    special = {
        "\x01": "ő",
        "\x02": "mű",
        "\x81": "ü",
        "\x82": "É",
        "\x86": "§",
        "i": "á",
        "p": "é",
        "t": "í",
        "y": "ó",
        "|": "ö",
        "~": "ú",
        "Ę": "ő",
        "Ħ": "ű",
    }
    out: list[str] = []
    for char in text:
        if char in special:
            out.append(special[char])
        elif ord(char) < 160:
            out.append(chr(ord(char) + 29))
        else:
            out.append(char)
    return "".join(out)


def fix_text(text: str) -> str:
    replacements = {
        "\x01": "ő",
        "\x02": "mű",
        "\x82": "É",
        "\x84": "Ö",
        "\x99": "ö",
        "\x9d": "Ő",
        "Ë": "Í",
        "È": "Á",
        "¼": "Ω",
        "ڗ": "ρ",
        "±": "-",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    phrase_replacements = {
        "Válasszakia": "Válassza ki a ",
        "Válasszaki": "Válassza ki ",
        "Karikázzabe": "Karikázza be ",
        "karikázzabe": "karikázza be ",
        "Határozzameg": "Határozza meg ",
        "Határozza meg azer": "Határozza meg az er",
        "Azalábbi": "Az alábbi ",
        "Azeloszt": "Az eloszt",
        "Azáram": "Az áram",
        "Ahibavédelem": "A hibavédelem",
        "Atáplálás": "A táplálás",
        "A képenegy": "A képen egy ",
        "aképen": "a képen ",
        "képenlátható": "képen látható",
        "rajzalapján": "rajz alapján",
        "helyesválaszt": "helyes választ",
        "helyes választ!": "helyes választ!",
        "helyesmegállapítás": "helyes megállapítás",
        "helyes párosítást": "helyes párosítást",
        "megfelelően": "megfelelően",
        "UVálló": "UV álló",
        "védőcsővel": "védőcsővel",
        "vezetékfeszültségesését": "vezeték feszültségesését",
        "vezetékohmosellenállása": "vezeték ohmos ellenállása",
        "Napelemes rendszerekkialakításánál": "Napelemes rendszerek kialakításánál",
        "szigetüzeműrendszert": "szigetüzemű rendszert",
        "alakítanakki": "alakítanak ki",
        "rendszerműködésére": "rendszer működésére",
    }
    for bad, good in phrase_replacements.items():
        text = text.replace(bad, good)
    text = re.sub(r"\s+", " ", text)
    text = text.replace(" .", ".").replace(" ,", ",").replace(" ?", "?").replace(" !", "!")
    return text.strip()


def decode_text(font_info: dict[str, Any], raw: bytes, is_hex: bool = False) -> str:
    data = bytes.fromhex(raw.decode("ascii", errors="ignore")) if is_hex else decode_pdf_string(raw)
    if font_info.get("encoding") == "Identity-H" and len(data) % 2 == 0:
        base = "".join(chr(data[idx] * 256 + data[idx + 1]) for idx in range(0, len(data), 2))
        return fix_text(fix_identity_text(base))
    cmap = font_info.get("to_unicode", {})
    if cmap and len(data) % 2 == 0:
        text = "".join(cmap.get(data[idx] * 256 + data[idx + 1], "") for idx in range(0, len(data), 2))
        if text:
            return fix_text(text)
    if data.startswith(b"\xfe\xff") or (len(data) > 1 and data[0] == 0):
        try:
            return fix_text(data.decode("utf-16-be"))
        except UnicodeDecodeError:
            pass
    for encoding in ("cp1250", "cp1252", "latin1"):
        try:
            return fix_text(data.decode(encoding))
        except UnicodeDecodeError:
            continue
    return fix_text(data.decode("utf-8", errors="replace"))


def tokenize(data: bytes):
    idx = 0
    while idx < len(data):
        byte = data[idx]
        if byte in WHITES:
            idx += 1
            continue
        if byte == ord("%"):
            while idx < len(data) and data[idx] not in {10, 13}:
                idx += 1
            continue
        if byte == ord("/"):
            end = idx + 1
            while end < len(data) and data[end] not in DELIMS:
                end += 1
            yield ("name", data[idx + 1 : end])
            idx = end
            continue
        if byte == ord("("):
            end = idx + 1
            depth = 1
            out = bytearray()
            while end < len(data) and depth:
                char = data[end]
                if char == ord("\\"):
                    out.append(char)
                    end += 1
                    if end < len(data):
                        out.append(data[end])
                        end += 1
                    continue
                if char == ord("("):
                    depth += 1
                elif char == ord(")"):
                    depth -= 1
                    if not depth:
                        break
                out.append(char)
                end += 1
            yield ("literal", bytes(out))
            idx = end + 1
            continue
        if byte == ord("<"):
            end = idx + 1
            while end < len(data) and data[end] != ord(">"):
                end += 1
            yield ("hex", data[idx + 1 : end])
            idx = end + 1
            continue
        if byte == ord("["):
            end = idx + 1
            depth = 1
            out = bytearray()
            while end < len(data) and depth:
                char = data[end]
                if char == ord("["):
                    depth += 1
                elif char == ord("]"):
                    depth -= 1
                    if not depth:
                        break
                out.append(char)
                end += 1
            yield ("array", bytes(out))
            idx = end + 1
            continue
        end = idx
        while end < len(data) and data[end] not in DELIMS:
            end += 1
        if end == idx:
            idx += 1
        else:
            yield ("word", data[idx:end])
            idx = end


def parse_array_tokens(data: bytes):
    return list(tokenize(data))


def extract_text_chunks(content: bytes, font_infos: dict[str, dict[str, Any]]) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    stack: list[tuple[str, bytes]] = []
    in_text = False
    font_name = ""
    x = 0.0
    y = 0.0

    def number(item: tuple[str, bytes]) -> float:
        try:
            return float(item[1].decode("ascii", errors="ignore"))
        except ValueError:
            return 0.0

    def add_text(raw_type: str, raw: bytes) -> None:
        text = decode_text(font_infos.get(font_name, {}), raw, raw_type == "hex")
        if text:
            chunks.append(TextChunk(text=text, x=x, y=y, font=font_name))

    for token_type, value in tokenize(content):
        if token_type != "word":
            if in_text:
                stack.append((token_type, value))
            continue
        op = value.decode("latin1", errors="ignore")
        if op == "BT":
            in_text = True
            stack = []
            continue
        if op == "ET":
            in_text = False
            stack = []
            continue
        if not in_text:
            continue
        if op == "Tf":
            if len(stack) >= 2 and stack[-2][0] == "name":
                font_name = stack[-2][1].decode("latin1", errors="ignore")
            stack = []
        elif op == "Tm" and len(stack) >= 6:
            x = number(stack[4])
            y = number(stack[5])
            stack = []
        elif op == "Td" and len(stack) >= 2:
            x += number(stack[-2])
            y += number(stack[-1])
            stack = []
        elif op == "Tj" and stack:
            raw_type, raw = stack[-1]
            if raw_type in {"literal", "hex"}:
                add_text(raw_type, raw)
            stack = []
        elif op == "TJ" and stack:
            raw_type, raw = stack[-1]
            if raw_type == "array":
                parts: list[str] = []
                for part_type, part in parse_array_tokens(raw):
                    if part_type in {"literal", "hex"}:
                        parts.append(decode_text(font_infos.get(font_name, {}), part, part_type == "hex"))
                    elif part_type == "word":
                        try:
                            if float(part.decode("ascii", errors="ignore")) > 120 and (
                                not parts or not parts[-1].endswith(" ")
                            ):
                                parts.append(" ")
                        except ValueError:
                            pass
                text = "".join(parts)
                if text:
                    chunks.append(TextChunk(text=text, x=x, y=y, font=font_name))
            stack = []
        elif op in {"'", '"', "T*"}:
            stack = []
        else:
            stack.append((token_type, value))
    return chunks


def page_contents(objects: dict[int, PdfObj], page_obj: PdfObj) -> bytes:
    array_match = re.search(rb"/Contents\s*\[(.*?)\]", page_obj.raw, re.S)
    if array_match:
        parts = []
        for obj_id in re.findall(rb"(\d+)\s+\d+\s+R", array_match.group(1)):
            obj = objects.get(int(obj_id))
            if obj:
                parts.append(inflate(obj))
        return b"\n".join(parts)
    match = re.search(rb"/Contents\s+(\d+)\s+\d+\s+R", page_obj.raw)
    if not match:
        return b""
    obj = objects.get(int(match.group(1)))
    return inflate(obj) if obj else b""


def extract_lines(pdf_path: Path) -> tuple[dict[int, PdfObj], list[int], list[Line]]:
    data = pdf_path.read_bytes()
    objects = read_objects(data)
    pages = parse_page_ids(objects)
    lines: list[Line] = []
    for page_number, page_id in enumerate(pages, start=1):
        page_obj = objects[page_id]
        fonts = parse_font_resources(objects, page_obj)
        font_infos = parse_font_infos(objects, fonts)
        chunks = extract_text_chunks(page_contents(objects, page_obj), font_infos)
        groups: list[list[Any]] = []
        for chunk in chunks:
            if not chunk.text.strip():
                continue
            for group in groups:
                if abs(group[0] - chunk.y) < 2:
                    group[1].append(chunk)
                    break
            else:
                groups.append([chunk.y, [chunk]])
        for y, group_chunks in sorted(groups, key=lambda item: -item[0]):
            ordered = sorted(group_chunks, key=lambda chunk: chunk.x)
            text = fix_text("".join(chunk.text for chunk in ordered))
            if not text:
                continue
            lines.append(Line(page=page_number, y=y, text=text, fonts={chunk.font for chunk in ordered}))
    return objects, pages, lines


def is_noise(line: Line) -> bool:
    text = line.text
    if re.fullmatch(r"\d+/\d+", text):
        return True
    if line.y > 770 and not re.search(r"\d+\.\s*[Ff]eladat", text):
        return True
    if any(fragment in text for fragment in ("Versenyző", "MAGYAR KERESKEDELMI", "rendelet", "Szakma Kiváló")):
        return True
    return False


def split_sections(lines: list[Line]) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    marker_re = re.compile(r"^(\d+)\.\s*[Ff]eladat")
    for line in lines:
        if is_noise(line):
            continue
        match = marker_re.match(line.text)
        if match:
            if current:
                sections.append(current)
            current = {"number": int(match.group(1)), "page": line.page, "lines": [], "marker": line.text}
            tail = marker_re.sub("", line.text).strip()
            tail = re.sub(r"\d+\s*pont.*$", "", tail).strip()
            if tail:
                current["lines"].append(line)
            continue
        if current:
            current["lines"].append(line)
    if current:
        sections.append(current)
    return sections


def split_labeled_options(text: str) -> list[tuple[str, str]]:
    matches = list(re.finditer(r"([a-h])\)", text, re.I))
    if len(matches) < 2:
        return []
    out = []
    for idx, match in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        out.append((match.group(1).upper(), text[match.end() : end].strip()))
    return [(label, value) for label, value in out if value]


def parse_section(section: dict[str, Any]) -> dict[str, Any] | None:
    lines: list[Line] = section["lines"]
    correct_label = ""
    prompt_lines: list[str] = []
    option_blocks: list[dict[str, Any]] = []
    current_option: dict[str, Any] | None = None
    saw_option = False
    ready_for_options = False

    for line in lines:
        text = line.text
        correct_match = re.search(r"Helyes megold[aá]s\s*:\s*([a-h])", text, re.I)
        if correct_match:
            correct_label = correct_match.group(1).upper()
            continue
        normalized_instruction = re.sub(r"\s+", "", text.lower())
        if "karikázzabe" in normalized_instruction or "valasszaki" in normalized_instruction or "válasszaki" in normalized_instruction:
            ready_for_options = True
            if not saw_option and "helyes" in text.lower():
                prompt_lines.append(text)
            continue
        if not ready_for_options and not correct_label:
            prompt_lines.append(text)
            continue
        labeled = split_labeled_options(text)
        if labeled:
            for label, value in labeled:
                option_blocks.append(
                    {
                        "label": label,
                        "text": value,
                        "correct": False,
                        "fonts": set(line.fonts),
                        "start_fonts": set(line.fonts),
                    }
                )
            saw_option = True
            current_option = None
            continue
        label_match = re.match(r"^([a-h])[\).]\s*(.+)$", text, re.I)
        bullet_match = re.match(r"^[-−]\s*(.+)$", text)
        if label_match:
            if current_option:
                option_blocks.append(current_option)
            current_option = {
                "label": label_match.group(1).upper(),
                "text": label_match.group(2).strip(),
                "correct": False,
                "fonts": set(line.fonts),
                "start_fonts": set(line.fonts),
            }
            saw_option = True
            continue
        if bullet_match:
            if current_option:
                option_blocks.append(current_option)
            label = chr(ord("A") + len(option_blocks))
            current_option = {
                "label": label,
                "text": bullet_match.group(1).strip(),
                "correct": bool({"F3", "F4", "R10", "R11"} & line.fonts),
                "fonts": set(line.fonts),
                "start_fonts": set(line.fonts),
            }
            saw_option = True
            continue
        if current_option and saw_option and not text.lower().startswith("helyes"):
            current_option["text"] = f"{current_option['text']} {text}".strip()
            current_option["fonts"].update(line.fonts)
        elif not saw_option:
            prompt_lines.append(text)

    if current_option:
        option_blocks.append(current_option)
    if correct_label:
        for option in option_blocks:
            option["correct"] = option["label"] == correct_label
    else:
        for option in option_blocks:
            option["correct"] = bool({"F3", "F4", "R10", "R11"} & option.get("start_fonts", option["fonts"]))
    if len(option_blocks) < 2:
        return None
    labels = [option["label"] for option in option_blocks]
    if len(labels) != len(set(labels)):
        return None
    correct_count = sum(1 for option in option_blocks if option["correct"])
    if correct_count == 0:
        return None
    prompt = fix_text(" ".join(prompt_lines))
    if not prompt:
        return None
    question_type = "single_choice" if correct_count == 1 else "multi_choice"
    return {
        "number": section["number"],
        "page": section["page"],
        "prompt": prompt,
        "options": option_blocks,
        "question_type": question_type,
        "correct_label": correct_label,
    }


def infer_topic(prompt: str) -> tuple[str, str, str]:
    lower = prompt.lower()
    rules = [
        ("napelem", "napelem", "napelem"),
        ("transzform", "transzformátor", "transzformátor"),
        ("aszinkron", "motorok", "aszinkron motor"),
        ("motor", "motorok", "motor"),
        ("kábel", "vezetékek", "kábel"),
        ("vezeték", "vezetékek", "vezeték"),
        ("védővezető", "érintésvédelem", "védővezető"),
        ("érintés", "érintésvédelem", "érintésvédelem"),
        ("hurokimpedancia", "érintésvédelem", "hurokimpedancia"),
        ("áram-védőkapcsoló", "érintésvédelem", "áram-védőkapcsoló"),
        ("túlfeszültség", "túlfeszültség-védelem", "túlfeszültség-védelem"),
        ("villám", "villámvédelem", "villámvédelem"),
        ("kapcsoló", "kapcsolások", "kapcsoló"),
        ("rajz", "szereléstechnika", "rajz"),
        ("feszültségesés", "számítás", "feszültségesés"),
    ]
    for needle, topic, subtopic in rules:
        if needle in lower:
            return topic, subtopic, needle
    return "szakmai-ismeretek", "versenyfeladat", "szakmai verseny"


def parse_xobject_map(objects: dict[int, PdfObj], page_obj: PdfObj) -> dict[str, int]:
    xobject_match = re.search(rb"/XObject\s*<<(.*?)>>", page_obj.raw, re.S)
    if xobject_match:
        body = xobject_match.group(1)
    else:
        ref_match = re.search(rb"/XObject\s+(\d+)\s+\d+\s+R", page_obj.raw)
        if not ref_match:
            return {}
        body = objects.get(int(ref_match.group(1)), PdfObj(b"", None, b"")).raw
    return {
        name.decode("latin1"): int(obj_id)
        for name, obj_id in re.findall(rb"/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R", body)
    }


def export_image_obj(objects: dict[int, PdfObj], obj_id: int, target: Path) -> bool:
    obj = objects.get(obj_id)
    if not obj or b"/Subtype/Image" not in obj.raw.replace(b" ", b""):
        return False
    stream = obj.stream or b""
    try:
        if b"DCTDecode" in obj.raw:
            Image.open(BytesIO(stream)).save(target)
            return True
        if b"FlateDecode" in obj.raw:
            data = zlib.decompress(stream)
            width = int(re.search(rb"/Width\s+(\d+)", obj.raw).group(1))
            height = int(re.search(rb"/Height\s+(\d+)", obj.raw).group(1))
            bits = int(re.search(rb"/BitsPerComponent\s+(\d+)", obj.raw).group(1))
            if bits != 8:
                return False
            mode = "RGB" if b"/DeviceRGB" in obj.raw else "L" if b"/DeviceGray" in obj.raw else ""
            if not mode:
                return False
            Image.frombytes(mode, (width, height), data).save(target)
            return True
    except Exception:
        return False
    return False


def page_image_objects(objects: dict[int, PdfObj], pages: list[int]) -> dict[int, list[int]]:
    by_page: dict[int, list[int]] = {}
    for page_number, page_id in enumerate(pages, start=1):
        page_obj = objects[page_id]
        xobjects = parse_xobject_map(objects, page_obj)
        content = page_contents(objects, page_obj)
        used: list[int] = []
        for name in re.findall(rb"/([A-Za-z0-9]+)\s+Do", content):
            obj_id = xobjects.get(name.decode("latin1"))
            if obj_id and obj_id not in used:
                used.append(obj_id)
        by_page[page_number] = used
    return by_page


def ensure_source(sources: list[dict[str, str]], year: int, source_id_num: int) -> tuple[str, int]:
    existing_source_by_year = {
        2017: "S26",
        2018: "S27",
        2019: "S21",
        2020: "S28",
        2021: "S29",
        2022: "S30",
    }
    existing_source_id = existing_source_by_year.get(year)
    if existing_source_id and any(row["source_id"] == existing_source_id for row in sources):
        return existing_source_id, source_id_num

    rel_path = f"../szakma sztár feladatok/Villanyszerelő_Megoldás_{year}.pdf"
    for row in sources:
        if row["path"] == rel_path:
            return row["source_id"], source_id_num
    source_id = f"S{source_id_num}"
    sources.append(
        {
            "source_id": source_id,
            "title": f"Szakma Kiváló Tanulója Verseny {year}",
            "path": rel_path,
            "source_type": "pdf",
            "year": str(year),
            "category": "vizsga",
            "notes": "Megoldókulcs import, automatikus feldolgozás",
        }
    )
    return source_id, source_id_num + 1


def import_years() -> None:
    questions = read_csv(BANK_DIR / "questions.csv")
    choices = read_csv(BANK_DIR / "choices.csv")
    assets = read_csv(BANK_DIR / "assets.csv")
    sources = read_csv(BANK_DIR / "sources.csv")

    q_fields = list(questions[0].keys())
    c_fields = list(choices[0].keys())
    a_fields = list(assets[0].keys())
    s_fields = list(sources[0].keys())

    q_num = next_id("Q", questions, "question_id")
    c_num = next_id("C", choices, "choice_id")
    a_num = next_id("A", assets, "asset_id")
    s_num = next_id("S", sources, "source_id")
    existing_keys = {normalize_key(row["prompt_md"]) for row in questions}

    totals: dict[int, dict[str, int]] = {}
    for year in YEARS:
        pdf_path = RESOURCE_DIR / f"Villanyszerelő_Megoldás_{year}.pdf"
        if not pdf_path.exists():
            totals[year] = {"parsed": 0, "added": 0, "skipped": 0, "assets": 0}
            continue
        objects, pages, lines = extract_lines(pdf_path)
        parsed = [item for section in split_sections(lines) if (item := parse_section(section))]
        image_objects = page_image_objects(objects, pages)
        used_images: dict[int, int] = {}
        totals[year] = {"parsed": len(parsed), "added": 0, "skipped": 0, "assets": 0}
        source_id = ""
        for item in parsed:
            if (year, item["number"]) not in ACCEPTED_TASKS:
                totals[year]["skipped"] += 1
                continue
            key = normalize_key(item["prompt"])
            if key in existing_keys:
                totals[year]["skipped"] += 1
                continue
            if not source_id:
                source_id, s_num = ensure_source(sources, year, s_num)
            qid = f"Q{q_num}"
            q_num += 1
            topic, subtopic, tag = infer_topic(item["prompt"])
            correct_labels = [option["label"] for option in item["options"] if option["correct"]]
            explanation = (
                f"A megoldókulcs szerint a helyes válasz: {', '.join(correct_labels)}."
                if correct_labels
                else ""
            )
            questions.append(
                {
                    "question_id": qid,
                    "question_type": item["question_type"],
                    "prompt_md": item["prompt"],
                    "explanation_md": explanation,
                    "topic": topic,
                    "subtopic": subtopic,
                    "difficulty": "2",
                    "points": "2",
                    "time_estimate_sec": "30",
                    "source_id": source_id,
                    "source_locator": f"{item['page']}. oldal, {item['number']}. feladat",
                    "tags": f"SZKTV,{year},{tag}",
                    "language": "hu",
                    "correct_answer_md": "",
                    "answer_tolerance": "",
                }
            )
            for idx, option in enumerate(item["options"], start=1):
                choices.append(
                    {
                        "choice_id": f"C{c_num}",
                        "question_id": qid,
                        "choice_label": option["label"],
                        "choice_text_md": option["text"],
                        "is_correct": "true" if option["correct"] else "false",
                        "sort_order": str(idx),
                        "feedback_md": "",
                        "match_role": "",
                        "match_choice_id": "",
                        "group_label": "",
                    }
                )
                c_num += 1
            if IMAGE_HINT_RE.search(item["prompt"]):
                page = item["page"]
                image_idx = used_images.get(page, 0)
                candidates = image_objects.get(page, [])
                if image_idx < len(candidates):
                    filename = f"szktv_{year}_q{qid[1:]}_image.png"
                    target = MEDIA_DIR / filename
                    if export_image_obj(objects, candidates[image_idx], target):
                        assets.append(
                            {
                                "asset_id": f"A{a_num}",
                                "question_id": qid,
                                "path": f"../kerdesbank/media/{filename}",
                                "kind": "image",
                                "alt_text": f"SZKTV {year} {item['number']}. feladat képe",
                                "source_id": source_id,
                                "source_locator": f"{item['page']}. oldal, {item['number']}. feladat",
                            }
                        )
                        a_num += 1
                        used_images[page] = image_idx + 1
                        totals[year]["assets"] += 1
            existing_keys.add(key)
            totals[year]["added"] += 1

    write_csv(BANK_DIR / "sources.csv", s_fields, sources)
    write_csv(BANK_DIR / "questions.csv", q_fields, questions)
    write_csv(BANK_DIR / "choices.csv", c_fields, choices)
    write_csv(BANK_DIR / "assets.csv", a_fields, assets)
    for year in YEARS:
        stat = totals[year]
        print(
            f"{year}: parsed={stat['parsed']} added={stat['added']} "
            f"skipped={stat['skipped']} assets={stat['assets']}"
        )


if __name__ == "__main__":
    import_years()
