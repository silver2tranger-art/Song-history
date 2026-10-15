import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('deploy', Path(__file__).parents[1] / 'tools/deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeletionTests(unittest.TestCase):
    def test_withdraw_and_partial_retry(self):
        project = {'id': 'demo', 'path': 'work/demo/'}
        previous = {'projects': [project], 'keys': ['index.html', 'work/demo/index.html'], 'pending_delete': ['work/demo/old.png']}
        current = {'projects': [project], 'keys': ['index.html']}
        result = deploy.deletion_keys(previous, current)
        self.assertIn('work/demo/index.html', result)
        self.assertIn('work/demo/old.png', result)
        self.assertNotIn('index.html', result)

    def test_never_delete_unmanaged_bucket_objects(self):
        current = {'projects': [], 'keys': ['index.html']}
        with self.assertRaises(ValueError):
            deploy.deletion_keys({'keys': ['other-app/private.pdf']}, current)
        self.assertFalse(deploy.managed('work/demo/../private.txt', [{'path': 'work/demo/'}]))


if __name__ == '__main__': unittest.main()
