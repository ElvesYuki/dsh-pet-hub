"""Independent wire peer for the VP8 host-only TCP fixture."""

import socket
import struct
import subprocess
import sys


FRAME = struct.Struct("<4sBBHIIHHI")


def packet(kind, sequence, action=0, value=0):
    return FRAME.pack(b"VPC1", 1, kind, 0, 1, sequence, 0, action, value)


def read_frame(peer):
    result = b""
    while len(result) < FRAME.size:
        part = peer.recv(FRAME.size - len(result))
        if not part:
            raise AssertionError("device closed before completing a reply")
        result += part
    return result


def loopback(executable):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        listener.settimeout(4)
        with subprocess.Popen([executable, str(listener.getsockname()[1])]) as device:
            try:
                with listener.accept()[0] as peer:
                    peer.settimeout(4)
                    play = packet(1, 1, 57, 10000)
                    peer.sendall(play[:7])
                    peer.sendall(play[7:])
                    assert read_frame(peer) == packet(128, 1, 57)
                    peer.sendall(packet(1, 2, 4, 10000) + packet(2, 3))
                    assert read_frame(peer) == packet(131, 1, 57)
                    assert read_frame(peer) == packet(128, 2, 4)
                    assert read_frame(peer) == packet(133, 3)
                    assert read_frame(peer) == packet(129, 2, 4, 77)
                    peer.sendall(packet(2, 3) + packet(1, 4, 900, 10000))
                    assert read_frame(peer) == packet(134, 3)
                    assert read_frame(peer) == packet(128, 4, 900)
                    assert read_frame(peer) == packet(130, 4, 900)
                    peer.shutdown(socket.SHUT_WR)
                    assert peer.recv(1) == b""
                assert device.wait(timeout=4) == 0
            finally:
                if device.poll() is None:
                    device.terminate()


if __name__ == "__main__":
    loopback(sys.argv[1])
    print("VP8 TCP loopback passed")
