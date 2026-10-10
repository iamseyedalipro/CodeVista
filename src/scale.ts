import type { FlowBundle, FlowNode, FlowProcess } from "./types.js";

/** A deterministic synthetic load fixture, not a claim about a real product's behavior. */
export function scaleSample(): FlowBundle {
  const evidence = {
    kind: "code" as const,
    references: [{ path: "src/scale.ts", symbol: "scaleSample" }],
  };
  const coverage = {
    status: "complete" as const,
    scope: "This synthetic performance fixture only.",
    gaps: [],
  };
  function process(
    id: string,
    title: string,
    count: number,
    child?: string,
    loop = false,
  ): FlowProcess {
    const nodes: FlowNode[] = Array.from({ length: count }, (_, index) => ({
      id: `${id}-step-${index + 1}`,
      title: `Synthetic step ${index + 1}`,
      description: `Performance fixture step ${index + 1}; it does not represent real product behavior.`,
      behavior: "implemented",
      evidence,
      ...(index === 0
        ? { kind: "start" as const }
        : index === count - 1
          ? { kind: "end" as const, outcome: "success" as const }
          : index === 4 && child
            ? { kind: "subprocess" as const, processId: child }
            : index === 9 && loop
              ? { kind: "decision" as const }
              : { kind: "action" as const }),
    }));
    const edges = nodes
      .slice(0, -1)
      .map((node, index) => ({
        id: `${id}-edge-${index + 1}`,
        from: node.id,
        to: nodes[index + 1]!.id,
        label: "Continue",
        kind: "normal" as const,
        ...(loop && index === 9
          ? { condition: "The synthetic check passes" }
          : {}),
      }));
    return {
      schemaVersion: "1.0.0",
      id,
      title,
      purpose: "Synthetic scale and navigation fixture.",
      behavior: "implemented",
      evidence,
      coverage,
      entryNodeId: nodes[0]!.id,
      nodes,
      edges: [
        ...edges,
        ...(loop
          ? [
              {
                id: `${id}-retry`,
                from: nodes[9]!.id,
                to: nodes[8]!.id,
                label: "Retry",
                kind: "retry" as const,
                condition: "The synthetic check requests a retry",
              },
            ]
          : []),
      ],
    };
  }
  const roots = Array.from({ length: 10 }, (_, index) =>
    process(
      `scale-${index + 1}`,
      `Synthetic process ${index + 1}`,
      40,
      "scale-shared",
      index === 0,
    ),
  );
  const processes = [
    ...roots,
    process("scale-shared", "Shared synthetic subprocess", 8, "scale-leaf"),
    process("scale-leaf", "Deep synthetic process", 5),
  ];
  return {
    manifest: {
      schemaVersion: "1.0.0",
      project: {
        id: "scale-fixture",
        name: "Synthetic scale fixture",
        description:
          "Ten root processes and 413 nodes for reproducible performance checks.",
        contentLanguage: "en",
        repository: {
          host: "github.com",
          owner: "iamseyedalipro",
          name: "CodeVista",
        },
      },
      coverage,
      rootProcessIds: roots.map((item) => item.id),
      processes: processes.map((item) => ({
        id: item.id,
        file: `processes/${item.id}.json`,
      })),
      relationships: [
        {
          id: "scale-relationship",
          from: "scale-1",
          to: "scale-2",
          label: "Synthetic handoff",
          description:
            "A synthetic connection used to verify overview relationship rendering.",
        },
      ],
    },
    processes,
  };
}
