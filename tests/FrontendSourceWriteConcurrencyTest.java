import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.locks.ReentrantLock;

/*
 * Rhino values are not shared across worker threads. This Java-only harness
 * exercises the same bounded lock, revision check and atomic move contract
 * without invoking one Rhino block instance concurrently.
 */
public final class FrontendSourceWriteConcurrencyTest {
	private static final ReentrantLock WRITE_LOCK = new ReentrantLock();

	private static String hash(byte[] content) throws Exception {
		byte[] digest = MessageDigest.getInstance("SHA-256").digest(content);
		StringBuilder value = new StringBuilder();
		for (byte item : digest) {
			value.append(String.format("%02x", item & 0xff));
		}
		return value.toString();
	}

	private static boolean update(Path source, String revision, byte[] content, CountDownLatch ready, CountDownLatch start)
			throws Exception {
		ready.countDown();
		start.await();
		WRITE_LOCK.lock();
		try {
			if (!hash(Files.readAllBytes(source)).equals(revision)) {
				return false;
			}
			Path temporary = Files.createTempFile(source.getParent(), "." + source.getFileName(), ".tmp");
			try {
				Files.write(temporary, content);
				try {
					Files.move(temporary, source, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
				} catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
					Files.move(temporary, source, StandardCopyOption.REPLACE_EXISTING);
				}
			} finally {
				Files.deleteIfExists(temporary);
			}
			return true;
		} finally {
			WRITE_LOCK.unlock();
		}
	}

	public static void main(String[] args) throws Exception {
		Path root = Files.createTempDirectory("flow-source-write-concurrency");
		Path source = root.resolve("+page.flow.svelte");
		byte[] initial = "<FlowComponent id=\"initial\"><Structure /></FlowComponent>\n".getBytes(StandardCharsets.UTF_8);
		byte[] left = ("<FlowComponent id=\"left\"><Structure />" + "x".repeat(64 * 1024)
				+ "</FlowComponent>\n").getBytes(StandardCharsets.UTF_8);
		byte[] right = ("<FlowComponent id=\"right\"><Structure />" + "y".repeat(64 * 1024)
				+ "</FlowComponent>\n").getBytes(StandardCharsets.UTF_8);
		Files.write(source, initial);
		String revision = hash(initial);

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try {
			Future<Boolean> first = executor.submit(() -> update(source, revision, left, ready, start));
			Future<Boolean> second = executor.submit(() -> update(source, revision, right, ready, start));
			ready.await();
			start.countDown();
			boolean firstWon = first.get();
			boolean secondWon = second.get();
			if (firstWon == secondWon) {
				throw new AssertionError("Exactly one concurrent update must succeed.");
			}
			byte[] saved = Files.readAllBytes(source);
			byte[] expected = firstWon ? left : right;
			if (!Arrays.equals(saved, expected)) {
				throw new AssertionError("The winning source was truncated or replaced.");
			}
		} finally {
			executor.shutdownNow();
			Files.walk(root).sorted((leftPath, rightPath) -> rightPath.compareTo(leftPath)).forEach(path -> {
				try {
					Files.deleteIfExists(path);
				} catch (Exception error) {
					throw new RuntimeException(error);
				}
			});
		}
		System.out.println("frontend source concurrent write test passed");
	}
}
