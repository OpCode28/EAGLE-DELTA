import socket
import time
import argparse

def main():
    parser = argparse.ArgumentParser(description="Generate fast Wi-Fi traffic for CSI collection")
    parser.add_argument("--ip", default="192.168.31.145", help="IP address to blast (use Node 1's IP)")
    parser.add_argument("--rate", type=int, default=50, help="Packets per second")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    payload = b"X" * 1000  # 1000 bytes heavy packet
    port = 54321

    print(f"🚀 Blasting {args.ip} with {args.rate} heavy UDP packets per second...")
    print("Keep this terminal window open and running in the background!")
    print("Press Ctrl+C to stop.")

    delay = 1.0 / args.rate
    
    try:
        while True:
            sock.sendto(payload, (args.ip, port))
            time.sleep(delay)
    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()
