# syntax=docker/dockerfile:1
# linux/amd64 与 linux/arm64 均可构建：两个基础镜像都发布了这两种架构。

FROM rust:1.88.0-bookworm AS builder
WORKDIR /src

# 先只编译依赖，源码改动不让依赖层失效。
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && printf '\n' > src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src target/release/x-ziwei target/release/deps/x_ziwei* target/release/.fingerprint/x-ziwei-*

COPY src ./src
RUN touch src/lib.rs src/main.rs \
    && cargo build --release --locked --bin x-ziwei

FROM debian:bookworm-slim
# 根证书只在拉取白名单 URL 的知识包时用到。
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/target/release/x-ziwei /usr/local/bin/x-ziwei
EXPOSE 8080
USER nobody
ENTRYPOINT ["/usr/local/bin/x-ziwei"]
# 默认监听 0.0.0.0:8080；部署时在此之后追加 --allowed-host、--public-url、--trust-proxy 等参数。
CMD ["serve"]
