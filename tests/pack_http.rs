//! 真实 chunked HTTP 上游未结束响应时，知识包仍须立即拒绝超限正文。
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::time::Duration;
use x_ziwei::{ErrorCode, PackPolicy, PackRef, PackStore};

#[tokio::test]
async fn oversized_chunked_pack_is_rejected_before_end_of_response() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/pack.json", listener.local_addr().unwrap());
    let (finish, wait) = mpsc::channel();
    let upstream = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        socket
            .set_write_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut reader = BufReader::new(&mut socket);
        loop {
            let mut line = String::new();
            assert!(reader.read_line(&mut line).unwrap() > 0);
            if line == "\r\n" {
                break;
            }
        }
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n")
            .unwrap();
        let body = vec![b' '; 1024 * 1024 + 1];
        write!(socket, "{:x}\r\n", body.len()).unwrap();
        socket.write_all(&body).unwrap();
        socket.write_all(b"\r\n").unwrap();
        // 不发送结束块，读取方必须按累计大小拒绝，不能等待完整响应。
        wait.recv_timeout(Duration::from_secs(5)).unwrap();
    });
    let store = PackStore::new(PackPolicy {
        allow_dirs: vec![],
        allow_urls: vec![url.clone()],
    })
    .unwrap();
    let result = tokio::time::timeout(Duration::from_secs(2), store.load(PackRef::Url(url))).await;
    finish.send(()).unwrap();
    upstream.join().unwrap();
    assert_eq!(
        result
            .expect("must reject before response ends")
            .unwrap_err()
            .code,
        ErrorCode::InvalidArgument
    );
}
