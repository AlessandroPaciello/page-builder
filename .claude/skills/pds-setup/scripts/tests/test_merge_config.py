# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest>=8.0", "pyyaml"]
# ///
"""Tests for merge-config.py — the fixed configuration and its refusals (Story 2.28).

Run: uv run --with pytest --with pyyaml pytest skills/pds/pds-setup/scripts/tests/test_merge_config.py

The behaviour under test is the acceptance criterion of the story: the four fixed
values (`framework=react`, `headless=base-ui`, `styling=tailwind-v4`,
`fonts=fontsource`) end up in `_bmad/config.yaml`, and any other value is an
explicit refusal — exit 1, a message that names the variable and the allowed
values, and no write at all.
"""

import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml

SCRIPTS = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("merge_config", SCRIPTS / "merge-config.py")
merge_config = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(merge_config)

MODULE_YAML = SCRIPTS.parent / "assets" / "module.yaml"

FIXED = {
    "framework": "react",
    "headless": "base-ui",
    "styling": "tailwind-v4",
    "fonts": "fontsource",
}

PRE_EXISTING = """\
document_output_language: Italiano
output_folder: '{project-root}/_bmad-output'
pds:
  name: Penpot DS
  version: 1.0.0
"""


def invoke(tmp_path, answers, module_yaml=MODULE_YAML, legacy=False, config_text=None):
    """Point sys.argv at a throwaway project and return (config, user) paths."""
    bmad = tmp_path / "_bmad"
    bmad.mkdir(parents=True, exist_ok=True)
    config = bmad / "config.yaml"
    user = bmad / "config.user.yaml"
    if config_text is not None:
        config.write_text(config_text, encoding="utf-8")

    answers_file = tmp_path / "answers.json"
    answers_file.write_text(json.dumps(answers), encoding="utf-8")

    argv = [
        "merge-config.py",
        "--config-path",
        str(config),
        "--module-yaml",
        str(module_yaml),
        "--answers",
        str(answers_file),
        "--user-config-path",
        str(user),
    ]
    if legacy:
        argv += ["--legacy-dir", str(bmad)]
    return config, user, argv


def config_of(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def run_ok(monkeypatch, capsys, tmp_path, answers, **kwargs):
    config, _user, argv = invoke(tmp_path, answers, **kwargs)
    monkeypatch.setattr(sys, "argv", argv)
    merge_config.main()
    result = json.loads(capsys.readouterr().out)
    return config, result


def run_error(monkeypatch, capsys, tmp_path, answers, **kwargs):
    config, _user, argv = invoke(tmp_path, answers, **kwargs)
    monkeypatch.setattr(sys, "argv", argv)
    with pytest.raises(SystemExit) as excinfo:
        merge_config.main()
    assert excinfo.value.code == 1
    return config, capsys.readouterr().err


def test_the_four_fixed_values_are_written(monkeypatch, capsys, tmp_path):
    config, _result = run_ok(monkeypatch, capsys, tmp_path, {"module": dict(FIXED)})
    section = config_of(config)["pds"]
    for key, value in FIXED.items():
        assert section[key] == value


def test_fixed_values_are_written_when_the_answers_omit_them(monkeypatch, capsys, tmp_path):
    config, result = run_ok(monkeypatch, capsys, tmp_path, {"module": {}})
    section = config_of(config)["pds"]
    for key, value in FIXED.items():
        assert section[key] == value
    assert sorted(result["fixed_values"]) == sorted(FIXED)
    assert result["module_variables"] == FIXED


def test_an_empty_value_is_filled_with_the_fixed_one(monkeypatch, capsys, tmp_path):
    config, result = run_ok(monkeypatch, capsys, tmp_path, {"module": {"framework": ""}})
    assert config_of(config)["pds"]["framework"] == "react"
    assert "framework" in result["fixed_values"]


def test_the_result_shows_what_was_written(monkeypatch, capsys, tmp_path):
    _config, result = run_ok(monkeypatch, capsys, tmp_path, {"module": {}})
    assert result["status"] == "success"
    assert result["module_code"] == "pds"
    assert result["module_variables"] == FIXED


@pytest.mark.parametrize(
    "answers, variable, refused, allowed",
    [
        ({"headless": "radix"}, "headless", "radix", "base-ui"),
        ({"framework": "vue"}, "framework", "vue", "react"),
        ({"styling": "tailwind-v3"}, "styling", "tailwind-v3", "tailwind-v4"),
        ({"fonts": "next/font"}, "fonts", "next/font", "fontsource"),
    ],
)
def test_another_value_is_refused(monkeypatch, capsys, tmp_path, answers, variable, refused, allowed):
    config, err = run_error(monkeypatch, capsys, tmp_path, {"module": answers})
    payload = json.loads(err)
    assert payload["status"] == "error"
    problems = " ".join(payload["problems"])
    assert f"'{variable}'" in problems
    assert refused in problems
    assert allowed in problems
    assert "not supported" in problems
    assert not config.exists(), "the refusal must not write config.yaml"


def test_the_refusal_leaves_an_existing_config_untouched(monkeypatch, capsys, tmp_path):
    config, _err = run_error(
        monkeypatch, capsys, tmp_path, {"module": {"headless": "radix"}}, config_text=PRE_EXISTING
    )
    assert config.read_text(encoding="utf-8") == PRE_EXISTING


def test_an_unknown_variable_is_refused(monkeypatch, capsys, tmp_path):
    config, err = run_error(monkeypatch, capsys, tmp_path, {"module": {"theme": "ocean"}})
    payload = json.loads(err)
    assert "'theme'" in payload["problems"][0]
    assert "not a module variable" in payload["problems"][0]
    assert not config.exists()


@pytest.mark.parametrize("module_value", [[], "", 0, False])
def test_a_falsy_module_value_is_still_refused(monkeypatch, capsys, tmp_path, module_value):
    """`answers.get("module") or {}` swallowed a falsy value: the check must see it."""
    config, err = run_error(monkeypatch, capsys, tmp_path, {"module": module_value})
    assert "'module' in the answers file must be an object" in err
    assert not config.exists()


@pytest.mark.parametrize("module_value", [0, False])
def test_a_falsy_module_value_is_refused_before_the_legacy_merge(monkeypatch, capsys, tmp_path, module_value):
    """`apply_legacy_defaults` used to raise on a falsy `module` before the JSON refusal."""
    legacy = tmp_path / "_bmad" / "pds" / "config.yaml"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text("framework: react\n", encoding="utf-8")

    config, err = run_error(monkeypatch, capsys, tmp_path, {"module": module_value}, legacy=True)

    assert "'module' in the answers file must be an object" in err
    assert legacy.exists(), "a refused setup must not delete the legacy config"
    assert not config.exists()


def test_an_answers_file_that_is_not_an_object_is_refused(monkeypatch, capsys, tmp_path):
    config, err = run_error(monkeypatch, capsys, tmp_path, [{"module": {}}])
    assert "The answers file must be a JSON object" in err
    assert not config.exists()


def test_a_legacy_value_is_refused_before_cleanup(monkeypatch, capsys, tmp_path):
    legacy = tmp_path / "_bmad" / "pds" / "config.yaml"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text("styling: tailwind-v3\n", encoding="utf-8")

    config, err = run_error(monkeypatch, capsys, tmp_path, {"module": {}}, legacy=True)

    assert "'styling'" in err
    assert legacy.exists(), "a refused setup must not delete the legacy config"
    assert not config.exists()


def test_the_legacy_values_are_used_as_fallbacks_when_they_are_supported(monkeypatch, capsys, tmp_path):
    legacy = tmp_path / "_bmad" / "pds" / "config.yaml"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text("framework: react\nfonts: fontsource\n", encoding="utf-8")

    config, _result = run_ok(monkeypatch, capsys, tmp_path, {"module": {}}, legacy=True)

    assert config_of(config)["pds"]["fonts"] == "fontsource"
    assert not legacy.exists()


SYNTHETIC_YAML = """\
code: demo
name: Demo
module_version: 1.0.0
default_selected: false

modes:
  default: ["light"]
  multi-select:
    - value: "light"
      label: "Light"

team:
  default: ""
  required: true

slug:
  default: "demo"
  regex: "^[a-z]+$"

flag:
  default: true
"""


@pytest.fixture
def synthetic(tmp_path):
    path = tmp_path / "demo.yaml"
    path.write_text(SYNTHETIC_YAML, encoding="utf-8")
    return path


@pytest.mark.parametrize(
    "answers, needle",
    [
        ({"modes": ["light", "midnight"]}, "midnight"),
        ({"team": ""}, "is required"),
        ({"slug": "Demo-1"}, "does not match"),
        ({"flag": "yes"}, "is not a boolean"),
    ],
)
def test_other_definitions_are_validated_too(monkeypatch, capsys, tmp_path, synthetic, answers, needle):
    _config, err = run_error(monkeypatch, capsys, tmp_path, {"module": answers}, module_yaml=synthetic)
    assert needle in err


def test_an_allowed_value_passes(monkeypatch, capsys, tmp_path, synthetic):
    config, _result = run_ok(
        monkeypatch,
        capsys,
        tmp_path,
        {"module": {"modes": ["light"], "team": "core", "slug": "demo", "flag": False}},
        module_yaml=synthetic,
    )
    section = config_of(config)["demo"]
    assert section["team"] == "core"
    assert section["flag"] is False
