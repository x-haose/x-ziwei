# syntax=docker/dockerfile:1
# linux/amd64 and linux/arm64. Official rust and debian images publish both.
# Dokploy builds this Dockerfile on the node (Oracle aarch64 or amd64).

FROM rust:1.88.0-bookworm AS builder
WORKDIR /src

COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && printf '\n' > src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src target/release/x-ziwei target/release/deps/x_ziwei* target/release/.fingerprint/x-ziwei-*

COPY src ./src
COPY contracts ./contracts
COPY static ./static
RUN touch src/lib.rs src/main.rs \
    && cargo build --release --locked --bin x-ziwei

FROM debian:bookworm-slim
COPY --from=builder /src/target/release/x-ziwei /usr/local/bin/x-ziwei
ENV BIND=0.0.0.0:8080
EXPOSE 8080
USER nobody
ENTRYPOINT ["/usr/local/bin/x-ziwei"]
