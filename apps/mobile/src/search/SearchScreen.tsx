import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import type { SearchEntityType, SearchResult } from "@karya/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import type { RootNavigationParamList } from "../navigation/linking";
import { useUniversalSearch } from "./useUniversalSearch";
import { createSearchStyles } from "./SearchScreen.styles";

type Props = NativeStackScreenProps<RootNavigationParamList, "Search">;
const SEARCH_DEBOUNCE_MS = 250;
const groups: Array<{ type: "profile" | "workspace" | "resource"; label: string }> = [
  { type: "profile", label: "Profiles" },
  { type: "workspace", label: "Workspaces" },
  { type: "resource", label: "Resources" },
];

export function SearchScreen({ navigation }: Props) {
  const scheme: KaryaColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const styles = useMemo(() => createSearchStyles(scheme), [scheme]);
  const { core, status, startupError, results, resultQuery, recentSearches } = useUniversalSearch();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);

  useEffect(() => {
    if (!core) return;
    const current = ++generation.current;
    if (!query.trim()) {
      setSearching(false);
      void core.shell.search("");
      return;
    }
    setSearching(true);
    setError(undefined);
    const timer = setTimeout(() => {
      void core.shell
        .search(query)
        .catch((cause: unknown) => {
          if (generation.current === current) setError(cause instanceof Error ? cause.message : "Search failed.");
        })
        .finally(() => {
          if (generation.current === current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [core, query]);

  if (status === "starting" || !core)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Starting search" />
      </View>
    );
  if (status === "failed")
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{startupError?.message ?? "Search could not start."}</Text>
      </View>
    );

  const open = async (result: SearchResult) => {
    Keyboard.dismiss();
    setError(undefined);
    try {
      await core.shell.openSearchResult(result, query);
      if (result.document.type === "resource")
        navigation.replace("ResourceDetail", { resourceId: result.document.sourceId });
      else navigation.navigate("Home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This result could not be opened.");
    }
  };
  const clearHistory = async () => {
    await core.shell.clearRecentSearches();
  };

  const visibleResults = resultQuery.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase() ? results : [];
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.close}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
        <TextInput
          accessibilityLabel="Search Karya"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          onSubmitEditing={() => {
            if (query.trim()) void core.shell.recordSearch(query);
          }}
          placeholder="Search your work"
          placeholderTextColor={colors[scheme].contentTertiary}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            onPress={() => setQuery("")}
            style={styles.clearQuery}
          >
            <Text style={styles.clearQueryText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {!query.trim() ? (
          <RecentSearches
            entries={recentSearches}
            onClear={() => void clearHistory()}
            onSelect={setQuery}
            styles={styles}
          />
        ) : searching && !visibleResults.length ? (
          <ActivityIndicator accessibilityLabel="Searching" style={styles.loader} />
        ) : visibleResults.length ? (
          groups.map((group) => {
            const items = visibleResults.filter((result) => result.document.type === group.type);
            return items.length ? (
              <ResultGroup
                key={group.type}
                label={group.label}
                items={items}
                onOpen={(result) => void open(result)}
                styles={styles}
              />
            ) : null;
          })
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing found</Text>
            <Text style={styles.emptyBody}>Try a Profile, Workspace, Resource name, type, or metadata value.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function RecentSearches({
  entries,
  onSelect,
  onClear,
  styles,
}: {
  entries: Array<{ query: string; searchedAt: string }>;
  onSelect: (query: string) => void;
  onClear: () => void;
  styles: ReturnType<typeof createSearchStyles>;
}) {
  if (!entries.length)
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Find anything</Text>
        <Text style={styles.emptyBody}>Search across your Profiles, Workspaces, and Resource metadata.</Text>
      </View>
    );
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        <Pressable accessibilityRole="button" onPress={onClear}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
      <View style={styles.group}>
        {entries.map((entry, index) => (
          <Pressable
            accessibilityRole="button"
            key={entry.query.toLocaleLowerCase()}
            onPress={() => onSelect(entry.query)}
            style={[styles.row, index < entries.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.resultTitle}>{entry.query}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function ResultGroup({
  label,
  items,
  onOpen,
  styles,
}: {
  label: string;
  items: SearchResult[];
  onOpen: (result: SearchResult) => void;
  styles: ReturnType<typeof createSearchStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <View style={styles.group}>
        {items.map((result, index) => (
          <Pressable
            accessibilityRole="button"
            key={result.document.id}
            onPress={() => onOpen(result)}
            style={[styles.row, index < items.length - 1 && styles.rowBorder]}
          >
            <View style={styles.resultBody}>
              <HighlightedTitle result={result} styles={styles} />
              <Text numberOfLines={1} style={styles.subtitle}>
                {result.document.subtitle ?? typeLabel(result.document.type)}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function HighlightedTitle({ result, styles }: { result: SearchResult; styles: ReturnType<typeof createSearchStyles> }) {
  const match = result.matches?.find((candidate) => candidate.field === "title");
  if (!match) return <Text style={styles.resultTitle}>{result.document.title}</Text>;
  const { title } = result.document;
  return (
    <Text style={styles.resultTitle}>
      {title.slice(0, match.start)}
      <Text style={styles.highlight}>{title.slice(match.start, match.start + match.length)}</Text>
      {title.slice(match.start + match.length)}
    </Text>
  );
}
function typeLabel(type: SearchEntityType) {
  return type === "profile" ? "Profile" : type === "workspace" ? "Workspace" : "Resource";
}
