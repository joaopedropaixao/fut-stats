#!/bin/bash
set -euo pipefail
: "${ORCA_SSH_PUBLIC_KEY:?Missing SSH public key}"
ssh-keygen -A
install -d -m 700 -o agent -g agent /home/agent/.ssh
printf '%s\n' "$ORCA_SSH_PUBLIC_KEY" > /home/agent/.ssh/authorized_keys
chown agent:agent /home/agent/.ssh/authorized_keys
chmod 600 /home/agent/.ssh/authorized_keys
printf 'export CLAUDE_CONFIG_DIR=/home/agent/.claude-personal\n' > /etc/profile.d/personal-claude.sh
printf 'CLAUDE_CONFIG_DIR=/home/agent/.claude-personal\n' > /etc/environment
exec /usr/sbin/sshd -D -e
