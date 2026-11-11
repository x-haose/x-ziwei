.PHONY: check fmt clippy build test
.NOTPARALLEL:

check: fmt clippy build test

fmt:
	cargo fmt --all -- --check

clippy:
	cargo clippy --locked --all-targets -- -D warnings

build:
	cargo build --release --locked

test:
	cargo test --locked
