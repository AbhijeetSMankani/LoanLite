"""
Shared test harness for todo/backendTodo.csv regression tests.

Same structure as pythonTests/featuresTodoTest/: each task in
todo/backendTodo.csv gets its own file here (taskNN_description.py),
written against the design agreed in that task's CSV row BEFORE the task
is implemented - a task's file is expected to FAIL until that task
actually lands, from then on it's that task's regression test.

Rather than duplicate the harness, this re-exports everything from
featuresTodoTest/common.py (same fixed TempTest.py accounts, same call()/
setup_users()/create_application() helpers, etc.) - run TempTest.py first
on a fresh database so those accounts exist before running any file here.

Usage inside a task file:

    from common import *

    users = setup_users()
    app = create_application(users.applicant)
    call("PATCH", f"/applications/submit/{app['id']}", token=users.applicant.token, expect=200,
         label="applicant submits the application")
    ...
    print_summary()
"""

import importlib.util
import os

_base_path = os.path.join(os.path.dirname(__file__), "..", "featuresTodoTest", "common.py")
_spec = importlib.util.spec_from_file_location("featurestodotest_common", _base_path)
_base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_base)

# Re-export everything (both files are named common.py - a plain `from common import *`
# here would collide with this very module's own name in sys.modules, so the base module
# is loaded under a distinct name via importlib instead).
globals().update({k: v for k, v in vars(_base).items() if not k.startswith("_")})
