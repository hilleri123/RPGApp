FROM debian:bookworm-slim

ARG SING_BOX_VERSION=1.12.12

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 \
    && curl -fsSL -o /tmp/sing-box.tgz \
        "https://github.com/SagerNet/sing-box/releases/download/v${SING_BOX_VERSION}/sing-box-${SING_BOX_VERSION}-linux-amd64.tar.gz" \
    && tar -xzf /tmp/sing-box.tgz -C /tmp \
    && mv /tmp/sing-box-${SING_BOX_VERSION}-linux-amd64/sing-box /usr/local/bin/sing-box \
    && chmod +x /usr/local/bin/sing-box \
    && rm -rf /tmp/sing-box.tgz /tmp/sing-box-${SING_BOX_VERSION}-linux-amd64 \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.py /entrypoint.py

ENTRYPOINT ["python3", "/entrypoint.py"]
