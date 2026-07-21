import type { KernelSnapshot } from "@karya/core";
import { Badge, Button, Surface, cn } from "@karya/ui";
import { HelpCircle, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";

type ExplainCapability = "continue-working" | "launch-sets" | "linking" | "relationships" | "search";

interface Explanation {
  example: string;
  summary: string;
  title: string;
}

const DISCOVERY_STORAGE_KEY = "karya.progressive-understanding.discovery.v1";
const DISCOVERY_EVENT = "karya:progressive-understanding:discovery";
const EXPLANATION_EVENT = "karya:progressive-understanding:explain";
const INTELLIGENCE_DISMISSAL_PREFIX = "karya.progressive-understanding.intelligence";

const EXPLANATIONS: Record<ExplainCapability, Explanation> = {
  "continue-working": {
    title: "What is Continue Working?",
    summary: "Continue Working restores the work that belongs to this Workspace.",
    example: "Return tomorrow and Karya can reopen the applications and Resources associated with this work.",
  },
  "launch-sets": {
    title: "What are Launch Sets?",
    summary: "Launch Sets bring an entire Workspace to life in a specific order.",
    example: "Open your editor, terminal, project folder, and reference notes together with one action.",
  },
  linking: {
    title: "What is Linking?",
    summary: "Linking lets Karya understand where your work lives without taking ownership of it.",
    example:
      "A linked project folder stays on your computer. Karya remembers its place in your work without copying it.",
  },
  relationships: {
    title: "What are Relationships?",
    summary: "Relationships describe how pieces of work meaningfully belong together.",
    example: "Connect meeting notes to the task they created, or documentation to the project it supports.",
  },
  search: {
    title: "What is Search?",
    summary: "Search finds work through its meaning and context, not only its location.",
    example: "Find a Resource, then let Karya restore the Profile and Workspace that give it context.",
  },
};

const DISCOVERY_CONCEPTS = [
  {
    label: "Profiles",
    question: "Who is this work for?",
    detail: "Keep different parts of your working life distinct.",
  },
  {
    label: "Workspaces",
    question: "What are you working on?",
    detail: "Bring everything meaningful to one body of work together.",
  },
  {
    label: "Spaces",
    question: "Where should your work live?",
    detail: "Give captures and Resources a clear place to land.",
  },
  {
    label: "Resources",
    question: "What belongs to your work?",
    detail: "Notes, files, folders, tasks, bookmarks, and applications.",
  },
] as const;

export function requestCapabilityExplanation(capability: ExplainCapability): void {
  window.dispatchEvent(new CustomEvent(EXPLANATION_EVENT, { detail: capability }));
}

export function ExplainThisButton({
  capability,
  className,
}: {
  capability: ExplainCapability;
  className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--karya-muted)] hover:bg-[var(--karya-control)] hover:text-[var(--karya-text)]",
        className,
      )}
      aria-label={`Explain ${EXPLANATIONS[capability].title.replace(/^What (is|are) /, "")}`}
      onClick={() => requestCapabilityExplanation(capability)}
    >
      <HelpCircle className="h-3.5 w-3.5" />
      Explain this
    </button>
  );
}

export function ProgressiveDiscoveryButton(): ReactElement {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label="Understand Karya"
      title="Understand Karya"
      onClick={() => window.dispatchEvent(new Event(DISCOVERY_EVENT))}
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}

export function ProgressiveUnderstandingLayer(): ReactElement {
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [explanation, setExplanation] = useState<ExplainCapability | undefined>();

  useEffect(() => {
    if (window.localStorage.getItem(DISCOVERY_STORAGE_KEY) !== "complete") setDiscoveryOpen(true);
    const showDiscovery = () => setDiscoveryOpen(true);
    const showExplanation = (event: Event) => {
      const capability = (event as CustomEvent<ExplainCapability>).detail;
      if (capability && EXPLANATIONS[capability]) setExplanation(capability);
    };
    window.addEventListener(DISCOVERY_EVENT, showDiscovery);
    window.addEventListener(EXPLANATION_EVENT, showExplanation);
    return () => {
      window.removeEventListener(DISCOVERY_EVENT, showDiscovery);
      window.removeEventListener(EXPLANATION_EVENT, showExplanation);
    };
  }, []);

  const completeDiscovery = () => {
    window.localStorage.setItem(DISCOVERY_STORAGE_KEY, "complete");
    setDiscoveryOpen(false);
  };

  return (
    <>
      {discoveryOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-md">
          <section
            className="w-full max-w-2xl rounded-2xl border border-[var(--karya-border-strong)] bg-[var(--karya-page)] p-5 shadow-[var(--karya-shadow-panel)] md:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="progressive-discovery-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="karya-section-label">A two-minute introduction</p>
                <h1 id="progressive-discovery-title" className="mt-2 text-2xl font-semibold text-[var(--karya-text)]">
                  Understand your work in four questions
                </h1>
                <p className="mt-2 text-sm text-[var(--karya-muted)]">
                  Everything else can be learned naturally while working.
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Skip introduction" onClick={completeDiscovery}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {DISCOVERY_CONCEPTS.map((concept, index) => (
                <div
                  key={concept.label}
                  className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-4"
                >
                  <div className="flex items-center gap-2">
                    <Badge>{index + 1}</Badge>
                    <p className="text-sm font-semibold text-[var(--karya-text)]">{concept.label}</p>
                  </div>
                  <p className="mt-3 text-base font-medium text-[var(--karya-text)]">{concept.question}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--karya-muted)]">{concept.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={completeDiscovery}>
                Skip
              </Button>
              <Button onClick={completeDiscovery}>Start working</Button>
            </div>
          </section>
        </div>
      ) : null}

      {explanation ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <section
            className="w-full max-w-md rounded-2xl border border-[var(--karya-border-strong)] bg-[var(--karya-page)] p-6 shadow-[var(--karya-shadow-panel)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capability-explanation-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="karya-section-label">Explain This</p>
                <h2 id="capability-explanation-title" className="mt-2 text-xl font-semibold text-[var(--karya-text)]">
                  {EXPLANATIONS[explanation].title}
                </h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close explanation"
                onClick={() => setExplanation(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-5 text-base leading-7 text-[var(--karya-text)]">{EXPLANATIONS[explanation].summary}</p>
            <div className="mt-4 rounded-xl bg-[var(--karya-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--karya-subtle)]">For example</p>
              <p className="mt-2 text-sm leading-6 text-[var(--karya-muted)]">{EXPLANATIONS[explanation].example}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setExplanation(undefined)}>Continue</Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function ExplainMyWorkspaceButton({
  onConfigureLaunchSet,
  snapshot,
  workspace,
}: {
  onConfigureLaunchSet(): void;
  snapshot: KernelSnapshot;
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement {
  const [open, setOpen] = useState(false);
  const profile = snapshot.profiles.all.find((candidate) => candidate.id === workspace.profileId);
  const defaultSpace = snapshot.workspaces.all.find((candidate) => candidate.id === profile?.defaultSpaceId);
  const resources = snapshot.resources.all.filter(
    (resource) =>
      resource.lifecycleState !== "deleted" &&
      (resource.primaryWorkspaceId === workspace.id || resource.workspaceRefs.includes(workspace.id)),
  );
  const relationshipIds = new Set(
    resources.flatMap((resource) => resource.relationships.map((relationship) => relationship.id)),
  );
  const applications = workspace.pinnedApplicationIds.filter((applicationId) =>
    snapshot.applications.installed.some((application) => application.metadata.id === applicationId),
  );
  const navigation = snapshot.shell.breadcrumbs.map((breadcrumb) => breadcrumb.label).join(" → ");

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> Explain my Workspace
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-md">
          <section
            className="w-full max-w-xl rounded-2xl border border-[var(--karya-border-strong)] bg-[var(--karya-page)] p-6 shadow-[var(--karya-shadow-panel)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="karya-section-label">Explain My Workspace</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--karya-text)]">{workspace.name}</h2>
                <p className="mt-1 text-sm text-[var(--karya-muted)]">This is how your work is currently organized.</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <WorkspaceMeaning label="Who is this work for?" value={profile?.name ?? "No active Profile"} />
              <WorkspaceMeaning label="What are you working on?" value={workspace.name} />
              <WorkspaceMeaning label="Where should new work live?" value={defaultSpace?.name ?? "No Default Space"} />
              <WorkspaceMeaning label="What belongs to this work?" value={`${resources.length} Resources`} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <WorkspaceCount label="Applications" value={applications.length} />
              <WorkspaceCount label="Relationships" value={relationshipIds.size} />
              <WorkspaceCount label="Launch Items" value={workspace.launchSet?.items.length ?? 0} />
            </div>
            {navigation ? (
              <p className="mt-4 rounded-lg bg-[var(--karya-surface-muted)] p-3 text-xs text-[var(--karya-muted)]">
                Current path: {navigation}
              </p>
            ) : null}
            {resources.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {resources.slice(0, 5).map((resource) => (
                  <Badge key={resource.id}>{resource.metadata.title}</Badge>
                ))}
                {resources.length > 5 ? <Badge>+{resources.length - 5} more</Badge> : null}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Continue
              </Button>
              {!workspace.launchSet?.enabled ? (
                <Button
                  onClick={() => {
                    setOpen(false);
                    onConfigureLaunchSet();
                  }}
                >
                  Configure Launch Set
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function WorkspaceIntelligenceCard({
  onOpenLaunchSet,
  onOpenRelationships,
  resources,
  snapshot,
  workspace,
}: {
  onOpenLaunchSet(): void;
  onOpenRelationships(): void;
  resources: KernelSnapshot["resources"]["all"];
  snapshot: KernelSnapshot;
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement | null {
  const suggestions = useMemo(() => {
    const applicationCount = workspace.pinnedApplicationIds.filter((id) =>
      snapshot.applications.installed.some((application) => application.metadata.id === id),
    ).length;
    const relationshipCount = new Set(
      resources.flatMap((resource) => resource.relationships.map((relationship) => relationship.id)),
    ).size;
    if (applicationCount >= 3 && !workspace.launchSet?.enabled) {
      return {
        id: "launch-set",
        title: "Restore this Workspace together",
        description: `${applicationCount} applications belong to this Workspace. A Launch Set can start them together.`,
        action: "Create Launch Set",
      };
    }
    if (resources.length >= 3 && relationshipCount === 0) {
      return {
        id: "relationships",
        title: "Make connected work visible",
        description: `${resources.length} Resources belong here. Relationships can explain how they support one another.`,
        action: "Explore Relationships",
      };
    }
    if (resources.length >= 10 && workspace.settings?.continuity.enabled === false) {
      return {
        id: "continuity",
        title: "Make this Workspace easier to resume",
        description: `${resources.length} Resources belong here. Continue Working can restore recent context without manual navigation.`,
        action: "Review Continue Working",
      };
    }
    return undefined;
  }, [resources, snapshot.applications.installed, workspace]);
  const [dismissedId, setDismissedId] = useState<string | undefined>();
  if (!suggestions || dismissedId === suggestions.id) return null;
  const dismissalKey = `${INTELLIGENCE_DISMISSAL_PREFIX}.${workspace.id}.${suggestions.id}`;
  if (typeof window !== "undefined" && window.localStorage.getItem(dismissalKey) === "dismissed") return null;
  const dismiss = () => {
    window.localStorage.setItem(dismissalKey, "dismissed");
    setDismissedId(suggestions.id);
  };
  const act = () => {
    if (suggestions.id === "relationships") onOpenRelationships();
    else onOpenLaunchSet();
  };
  return (
    <Surface className="flex flex-wrap items-center justify-between gap-4 border-[var(--karya-border-strong)] p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-[var(--karya-ring-soft)] p-2 text-[var(--karya-accent)]">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--karya-text)]">{suggestions.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--karya-muted)]">{suggestions.description}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
        <Button size="sm" onClick={act}>
          {suggestions.action}
        </Button>
      </div>
    </Surface>
  );
}

function WorkspaceMeaning({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-xl bg-[var(--karya-surface-muted)] p-4">
      <p className="text-xs text-[var(--karya-subtle)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--karya-text)]">{value}</p>
    </div>
  );
}

function WorkspaceCount({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-lg border border-[var(--karya-border)] p-3 text-center">
      <p className="text-lg font-semibold text-[var(--karya-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--karya-subtle)]">{label}</p>
    </div>
  );
}
