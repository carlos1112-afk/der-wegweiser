import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock

scripts_dir = Path(__file__).resolve().parent.parent / ".gemini" / "skills" / "gcs-security-assessment" / "scripts"
sys.path.insert(0, str(scripts_dir))

import cloud_rest_helpers_nodeps
import evaluate_project_security_posture as eval_posture


class TestCheckProjectDataAccessAuditLogsEnabled(unittest.TestCase):

  def test_project_has_both_logs_enabled(self):
    session = MagicMock()
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "auditConfigs": [
            {
                "service": "storage.googleapis.com",
                "auditLogConfigs": [
                    {"logType": "DATA_READ"},
                    {"logType": "DATA_WRITE"},
                ],
            }
        ]
    }
    mock_response.__enter__.return_value = mock_response
    session.request.return_value = mock_response

    result = eval_posture.check_project_data_access_audit_logs_enabled(
        "test-project", session
    )

    self.assertEqual(result, {"DATA_READ": True, "DATA_WRITE": True})
    self.assertEqual(session.request.call_count, 1)

  def test_inherited_from_org_policy(self):
    session = MagicMock()
    proj_resp = MagicMock()
    proj_resp.json.return_value = {
        "auditConfigs": [
            {
                "service": "storage.googleapis.com",
                "auditLogConfigs": [{"logType": "DATA_READ"}],
            }
        ]
    }
    proj_resp.__enter__.return_value = proj_resp

    proj_data_resp = MagicMock()
    proj_data_resp.json.return_value = {
        "name": "projects/123456",
        "parent": "organizations/7890",
    }
    proj_data_resp.__enter__.return_value = proj_data_resp

    org_resp = MagicMock()
    org_resp.json.return_value = {
        "auditConfigs": [
            {
                "service": "allServices",
                "auditLogConfigs": [{"logType": "DATA_WRITE"}],
            }
        ]
    }
    org_resp.__enter__.return_value = org_resp

    session.request.side_effect = [proj_resp, proj_data_resp, org_resp]

    result = eval_posture.check_project_data_access_audit_logs_enabled(
        "test-project", session
    )

    self.assertEqual(result, {"DATA_READ": True, "DATA_WRITE": True})

  def test_org_policy_error_handled_gracefully(self):
    session = MagicMock()
    proj_resp = MagicMock()
    proj_resp.json.return_value = {
        "auditConfigs": [
            {
                "service": "storage.googleapis.com",
                "auditLogConfigs": [{"logType": "DATA_READ"}],
            }
        ]
    }
    proj_resp.__enter__.return_value = proj_resp

    proj_data_resp = MagicMock()
    proj_data_resp.json.return_value = {
        "name": "projects/123456",
        "parent": "organizations/7890",
    }
    proj_data_resp.__enter__.return_value = proj_data_resp

    session.request.side_effect = [
        proj_resp,
        proj_data_resp,
        cloud_rest_helpers_nodeps.CloudRestError("Forbidden"),
    ]

    result = eval_posture.check_project_data_access_audit_logs_enabled(
        "test-project", session
    )

    self.assertEqual(result, {"DATA_READ": True, "DATA_WRITE": False})

  def test_project_policy_error_returns_error_dict(self):
    session = MagicMock()
    session.request.side_effect = cloud_rest_helpers_nodeps.CloudRestError(
        "Project IAM permission denied"
    )

    result = eval_posture.check_project_data_access_audit_logs_enabled(
        "test-project", session
    )

    self.assertEqual(result, {"error": "Project IAM permission denied"})


if __name__ == "__main__":
  unittest.main()
