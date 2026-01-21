export default function Footer() {
  return (
    <footer className="mt-5 py-5 border-t text-center text-gray-500">
      © {new Date().getFullYear()} Truemate AI. All rights reserved. <br />

      <span className="text-sm">
        A product of{" "}
        <a
          href="https://both-innovations.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-600 hover:underline"
        >
          Both Innovations
        </a>
      </span>
    </footer>
  );
}
