import type {
  AnalysisSnapshot,
  CompileSourceResult,
  ObjectLists,
} from "@megacrow/megalo";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  analyzeDocumentSnapshot,
  semanticTokensFromSnapshot,
} from "./artifacts";
import type { CompileResolvers } from "./protocol";
import type { MegacrowSession } from "./sessionSettings";

export interface SnapshotCacheEntry {
  /**
   * Lower → resolve base → encode result for this snapshot (default `mglo`
   * container). Shared by the diagnostics publish and `requestArtifacts`, so a
   * document version is compiled once.
   */
  compiled?: Promise<CompileSourceResult>;
  /** {@link SnapshotCache.epoch} the snapshot was analyzed in. */
  epoch: number;
  semanticTokens: number[];
  snapshot: AnalysisSnapshot;
  version: number;
}

export interface SnapshotRefreshOptions {
  objectLists?: ObjectLists;
  resolvers: CompileResolvers;
}

export class SnapshotCache {
  private readonly cache = new Map<string, SnapshotCacheEntry>();
  private readonly inflight = new Map<string, Promise<SnapshotCacheEntry>>();
  private currentEpoch = 0;

  /**
   * Bumped by {@link clear} (settings change, session reset). An analysis that
   * started in an older epoch is still returned to its caller, but never
   * written to the cache.
   */
  get epoch(): number {
    return this.currentEpoch;
  }

  delete(uri: string): void {
    this.cache.delete(uri);
    for (const key of [...this.inflight.keys()]) {
      if (key.startsWith(`${uri}:`)) {
        this.inflight.delete(key);
      }
    }
  }

  clear(): void {
    this.currentEpoch += 1;
    this.cache.clear();
    this.inflight.clear();
  }

  get(uri: string): SnapshotCacheEntry | undefined {
    return this.cache.get(uri);
  }

  refresh(
    uri: string,
    text: string,
    version: number,
    session: MegacrowSession,
    options: SnapshotRefreshOptions
  ): Promise<SnapshotCacheEntry> {
    const cached = this.cache.get(uri);
    if (cached && cached.version === version) {
      return Promise.resolve(cached);
    }

    const inflightKey = `${uri}:${version}`;
    const existing = this.inflight.get(inflightKey);
    if (existing) {
      return existing;
    }

    const epoch = this.currentEpoch;
    const promise: Promise<SnapshotCacheEntry> = (async () => {
      const snapshot = await analyzeDocumentSnapshot(text, session, {
        version: session.megaloVersion,
        objectLists: options.objectLists,
        fromUri: uri,
        resolvers: options.resolvers,
      });
      const entry: SnapshotCacheEntry = {
        snapshot,
        semanticTokens: semanticTokensFromSnapshot(snapshot),
        version,
        epoch,
      };
      if (epoch === this.currentEpoch) {
        this.cache.set(uri, entry);
      }
      return entry;
    })().finally(() => {
      if (this.inflight.get(inflightKey) === promise) {
        this.inflight.delete(inflightKey);
      }
    });

    this.inflight.set(inflightKey, promise);
    return promise;
  }

  async getOrRefresh(
    uri: string,
    doc: TextDocument,
    session: MegacrowSession,
    options: SnapshotRefreshOptions
  ): Promise<SnapshotCacheEntry> {
    const cached = this.cache.get(uri);
    if (cached && cached.version === doc.version) {
      return cached;
    }
    return await this.refresh(
      uri,
      doc.getText(),
      doc.version,
      session,
      options
    );
  }
}
