import { useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { FlowNode, FlowProcess } from "../src/types";
import { adjacentNodes, nodeCaption } from "../src/viewer";
import "@xyflow/react/dist/style.css";

type StageData = {
  stage: FlowNode;
  open: (id: string) => void;
  highlighted: boolean;
  dimmed: boolean;
};
type StageNode = Node<StageData, "stage">;
function Stage({ data }: NodeProps<StageNode>) {
  const node = data.stage;
  return (
    <div
      className={`stage ${data.highlighted ? "selected" : ""} ${data.dimmed ? "dimmed" : ""} kind-${node.kind}`}
    >
      {node.kind !== "start" && (
        <Handle type="target" position={Position.Top} />
      )}
      <div className="stage-kind">
        {nodeCaption(node)}
        {node.behavior !== "implemented" && ` · ${node.behavior}`}
      </div>
      <strong dir="auto">{node.title}</strong>
      {node.kind === "subprocess" && (
        <button
          className="open-child nodrag"
          onClick={(event) => {
            event.stopPropagation();
            data.open(node.processId);
          }}
        >
          Open subprocess <span>↗</span>
        </button>
      )}
      {node.kind !== "end" && (
        <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}
const nodeTypes = { stage: Stage };
// Only display positions are retained. Private content is never stored in browser storage.
const positions = new Map<string, Map<string, { x: number; y: number }>>();
const viewports = new Map<string, Viewport>();
export function clearViewState(): void {
  positions.clear();
  viewports.clear();
}

export function FlowCanvas({
  process,
  scope,
  selected,
  onSelect,
  onOpen,
}: {
  process: FlowProcess;
  scope: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const instance = useRef<ReactFlowInstance<StageNode, Edge> | null>(null);
  const key = `${scope}:${process.id}`;
  const layout = useMemo(() => {
    const graph = new dagre.graphlib.Graph({ multigraph: true });
    graph.setGraph({
      rankdir: "TB",
      nodesep: 95,
      ranksep: 120,
      marginx: 45,
      marginy: 40,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    const sizes = new Map(
      process.nodes.map((node) => [
        node.id,
        Math.max(
          104,
          64 +
            Math.ceil(node.title.length / 29) * 24 +
            (node.kind === "subprocess" ? 38 : 0),
        ),
      ]),
    );
    for (const node of process.nodes)
      graph.setNode(node.id, { width: 260, height: sizes.get(node.id) });
    for (const edge of process.edges)
      if (graph.hasNode(edge.from) && graph.hasNode(edge.to))
        graph.setEdge(
          edge.from,
          edge.to,
          { width: Math.min(340, edge.label.length * 7), height: 28 },
          edge.id,
        );
    dagre.layout(graph);
    const previous = positions.get(key) ?? new Map();
    const next = new Map<string, { x: number; y: number }>();
    for (const node of process.nodes) {
      const layoutNode = graph.node(node.id);
      let position = previous.get(node.id) ?? {
        x: layoutNode.x - 130,
        y: layoutNode.y - sizes.get(node.id)! / 2,
      };
      if (!previous.has(node.id) && previous.size) {
        const maxY = Math.max(
          ...[...previous.values(), ...next.values()].map((point) => point.y),
        );
        position = { x: layoutNode.x - 130, y: maxY + 240 };
      }
      next.set(node.id, position);
    }
    positions.set(key, next);
    if (positions.size > 100) positions.delete(positions.keys().next().value!);
    return { positions: next, sizes };
  }, [process, key]);
  const nearby = selected ? adjacentNodes(process, selected) : null;
  const nodes: StageNode[] = process.nodes.map((stage) => ({
    id: stage.id,
    type: "stage",
    position: layout.positions.get(stage.id)!,
    style: { width: 260, minHeight: layout.sizes.get(stage.id) },
    data: {
      stage,
      open: onOpen,
      highlighted: selected === stage.id,
      dimmed: !!nearby && !nearby.has(stage.id),
    },
    ariaLabel: stage.title,
  }));
  const edges: Edge[] = process.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: "smoothstep",
    // Marker colors are included in SVG IDs; avoid CSS var() parentheses in URL fragments.
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8190aa" },
    style: {
      stroke:
        edge.kind === "error"
          ? "var(--danger)"
          : edge.kind === "retry"
            ? "var(--warning)"
            : "var(--muted)",
      strokeWidth:
        selected && (edge.from === selected || edge.to === selected) ? 3 : 1.5,
      opacity:
        selected && edge.from !== selected && edge.to !== selected ? 0.18 : 1,
    },
    labelStyle: { fontSize: 12, fill: "var(--text)" },
    labelBgStyle: { fill: "var(--canvas)", fillOpacity: 0.96 },
    labelBgPadding: [8, 5],
  }));
  const saved = viewports.get(key);
  const focus = (id: string, initial = false) => {
    const point = layout.positions.get(id);
    if (point)
      void instance.current?.setCenter(
        point.x + 130,
        point.y + (initial ? 190 : (layout.sizes.get(id) ?? 104) / 2),
        { zoom: 0.85, duration: initial ? 0 : 160 },
      );
  };
  useEffect(() => {
    if (selected) {
      const frame = requestAnimationFrame(() => focus(selected));
      return () => cancelAnimationFrame(frame);
    }
  }, [selected, key]);
  return (
    <div className="flow-canvas" aria-label="Process flow diagram">
      <ReactFlow<StageNode, Edge>
        key={key}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(flow) => {
          instance.current = flow;
          if (selected) focus(selected, true);
          else if (!saved && process.entryNodeId)
            focus(process.entryNodeId, true);
        }}
        defaultViewport={saved}
        fitView={false}
        fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onMoveEnd={(_, viewport) => {
          viewports.set(key, viewport);
          if (viewports.size > 100)
            viewports.delete(viewports.keys().next().value!);
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        minZoom={0.12}
        maxZoom={1.7}
        deleteKeyCode={null}
      >
        <Background color="var(--border)" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="canvas-hint">
        Select a step for details <span>·</span> Scroll to zoom <span>·</span>{" "}
        Drag to explore
      </div>
    </div>
  );
}
