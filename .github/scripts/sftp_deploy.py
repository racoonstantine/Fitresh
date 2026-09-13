"""
Deploys public/ and api/ to Namecheap over SFTP only (no remote shell exec) --
this account's SSH access is SFTP/SCP-only, which is why an rsync-over-ssh
approach fails with a protocol mismatch (rsync needs to run a command on the
remote side; SFTP doesn't invoke a shell at all).

config.local.php lives only on the server and is intentionally never touched
here, so a deploy can never overwrite or delete your DB credentials.
"""
import os
import paramiko

HOST = os.environ["SSH_HOST"]
PORT = int(os.environ["SSH_PORT"])
USER = os.environ["SSH_USER"]
REMOTE_ROOT = os.environ["REMOTE_PATH"].rstrip("/")
KEY_PATH = os.path.expanduser("~/.ssh/deploy_key")

# (local dir relative to repo root, remote subdir under REMOTE_ROOT, filenames to skip)
DEPLOY_MAP = [
    ("public", "", set()),
    ("api", "api", {"config.local.php"}),
]


def remote_dir_exists(sftp, path):
    try:
        sftp.stat(path)
        return True
    except IOError:
        return False


def remote_mkdirs(sftp, remote_dir):
    parts = remote_dir.strip("/").split("/")
    path = ""
    for part in parts:
        path += "/" + part
        if not remote_dir_exists(sftp, path):
            sftp.mkdir(path)


def upload_dir(sftp, local_dir, remote_dir, exclude):
    remote_mkdirs(sftp, remote_dir)
    for entry in sorted(os.listdir(local_dir)):
        if entry in exclude:
            print(f"Skipping {entry} (excluded)")
            continue
        local_path = os.path.join(local_dir, entry)
        remote_path = f"{remote_dir}/{entry}"
        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path, exclude)
        else:
            print(f"Uploading {local_path} -> {remote_path}")
            sftp.put(local_path, remote_path)


def main():
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    transport = paramiko.Transport((HOST, PORT))
    transport.connect(username=USER, pkey=key)
    sftp = paramiko.SFTPClient.from_transport(transport)

    for local_dir, remote_subdir, exclude in DEPLOY_MAP:
        remote_dir = REMOTE_ROOT if not remote_subdir else f"{REMOTE_ROOT}/{remote_subdir}"
        upload_dir(sftp, local_dir, remote_dir, exclude)

    sftp.close()
    transport.close()
    print("Deploy complete.")


if __name__ == "__main__":
    main()
