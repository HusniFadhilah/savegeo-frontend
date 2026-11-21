import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MessageBubble from "./MessageBubble";

describe("chat message rendering", () => {
  it.each(["user", "assistant"] as const)("keeps hostile %s content as text", (role) => {
    const hostile = '<svg onload="alert(1)"><script>alert(2)</script></svg>';
    const { container } = render(<MessageBubble role={role} text={hostile} />);

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(container.querySelector("svg, script, img")).toBeNull();
  });

  it("keeps an untrusted attachment name as text", () => {
    const hostileName = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <MessageBubble role="user" text="Lampiran" file={{ name: hostileName, size_label: "1 KB", icon: "bi-file" }} />,
    );

    expect(container.textContent).toContain(hostileName);
    expect(container.querySelector("img, script, svg")).toBeNull();
  });
});
