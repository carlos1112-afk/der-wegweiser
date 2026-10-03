# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Unit tests for fetch_bucket_telemetry.py."""

import unittest
from unittest.mock import patch

from fetch_bucket_telemetry import (
    _calculate_risk_score,
    _is_soft_delete_enabled,
    _is_versioning_enabled,
    fetch_bucket_telemetry,
)


class TestFetchBucketTelemetry(unittest.TestCase):

  def test_is_versioning_enabled(self):
    self.assertTrue(_is_versioning_enabled(True))
    self.assertFalse(_is_versioning_enabled(False))
    self.assertTrue(_is_versioning_enabled("Enabled"))
    self.assertTrue(_is_versioning_enabled("true"))
    self.assertTrue(_is_versioning_enabled("1"))
    self.assertFalse(_is_versioning_enabled("Disabled"))
    self.assertFalse(_is_versioning_enabled("false"))
    self.assertFalse(_is_versioning_enabled(None))
    self.assertTrue(_is_versioning_enabled({"enabled": True}))
    self.assertFalse(_is_versioning_enabled({"enabled": False}))

  def test_is_soft_delete_enabled(self):
    self.assertTrue(_is_soft_delete_enabled(604800))
    self.assertTrue(_is_soft_delete_enabled("604800"))
    self.assertTrue(_is_soft_delete_enabled(1.0))
    self.assertFalse(_is_soft_delete_enabled(0))
    self.assertFalse(_is_soft_delete_enabled("0"))
    self.assertFalse(_is_soft_delete_enabled(-10))
    self.assertFalse(_is_soft_delete_enabled(None))
    self.assertFalse(_is_soft_delete_enabled("invalid"))

  def test_calculate_risk_score_empty(self):
    self.assertEqual(_calculate_risk_score([]), "0/100")

  def test_calculate_risk_score_fully_secure(self):
    telemetry = [{
        "bucket": "secure-bucket",
        "ubla_enabled": True,
        "soft_delete_retention_seconds": 604800,
        "enforced_encryption_types": ["CMEK"],
        "versioning": True,
        "tags": [],
    }]
    self.assertEqual(_calculate_risk_score(telemetry), "0/100")

  def test_calculate_risk_score_fully_insecure(self):
    telemetry = [{
        "bucket": "insecure-bucket",
        "ubla_enabled": False,
        "soft_delete_retention_seconds": None,
        "enforced_encryption_types": [],
        "versioning": False,
        "tags": [],
    }]
    self.assertEqual(_calculate_risk_score(telemetry), "100/100")

  def test_calculate_risk_score_partial(self):
    # Missing UBLA (+30) and Soft Delete (+20) -> Risk 50
    telemetry = [{
        "bucket": "partial-bucket",
        "ubla_enabled": False,
        "soft_delete_retention_seconds": 0,
        "enforced_encryption_types": ["CMEK"],
        "versioning": "Enabled",
        "tags": [],
    }]
    self.assertEqual(_calculate_risk_score(telemetry), "50/100")

  def test_calculate_risk_score_multiple_buckets_average(self):
    # Bucket 1: 0 risk
    # Bucket 2: 100 risk
    # Average: 50 risk
    telemetry = [
        {
            "bucket": "b1",
            "ubla_enabled": True,
            "soft_delete_retention_seconds": 604800,
            "enforced_encryption_types": ["CMEK"],
            "versioning": True,
        },
        {
            "bucket": "b2",
            "ubla_enabled": False,
            "soft_delete_retention_seconds": 0,
            "enforced_encryption_types": [],
            "versioning": False,
        },
    ]
    self.assertEqual(_calculate_risk_score(telemetry), "50/100")


if __name__ == "__main__":
  unittest.main()
