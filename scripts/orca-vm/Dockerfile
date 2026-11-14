FROM node:24-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server git gh sudo ca-certificates ripgrep && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code @openai/codex pnpm
RUN useradd -m -s /bin/bash agent && passwd -d agent && mkdir -p /run/sshd /workspace && chown agent:agent /workspace
RUN printf 'PasswordAuthentication no\nPermitRootLogin no\nAllowUsers agent\n' > /etc/ssh/sshd_config.d/personal.conf && rm -f /etc/ssh/ssh_host_*
COPY entrypoint.sh /usr/local/bin/orca-personal-entrypoint
RUN chmod 755 /usr/local/bin/orca-personal-entrypoint
ENV CLAUDE_CONFIG_DIR=/home/agent/.claude-personal
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/orca-personal-entrypoint"]
