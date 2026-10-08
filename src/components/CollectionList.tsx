import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { formatTotalDuration } from "../engine/engine";
import { usePlaylistCover } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import {
  useCollections,
  type Collection,
  type CollectionKind,
} from "../store/collections";
import { AppText } from "./AppText";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";

export type LibraryTab = "songs" | "recent" | CollectionKind;

type Props = {
  kind: CollectionKind;
  /** Search text (already lower-case and trimmed). */
  query: string;
  bottomSpace: number;
};

const GRID_GAP = 12;
const SIDE = 16;

export function openCollection(kind: CollectionKind, key: string) {
  router.push({ pathname: "/collection/[kind]", params: { kind, key } });
}

/** Cover from the first song that has artwork (albums, artists). */
function Cover({
  collection,
  size,
  round,
}: {
  collection: Collection;
  size: number;
  round?: boolean;
}) {
  const ids = useMemo(
    () => collection.songs.map((s) => s.id),
    [collection.songs],
  );
  const cover = usePlaylistCover(ids, size > 120 ? 400 : 160);
  const radius = round ? size / 2 : 16;
  if (cover)
    return (
      <Image
        source={{ uri: cover }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={120}
      />
    );
  return <ArtworkPlaceholder width={size} radius={radius} iconScale={0.36} />;
}

const AlbumCell = memo(function AlbumCell({
  collection,
  size,
}: {
  collection: Collection;
  size: number;
}) {
  const { t, tn } = useT();
  return (
    <Pressable
      onPress={() => openCollection("album", collection.key)}
      style={({ pressed }) => [
        styles.cell,
        { width: size, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Cover collection={collection} size={size} />
      <AppText weight="semibold" numberOfLines={1} style={styles.cellTitle}>
        {collection.name ?? t("common.unknownAlbum")}
      </AppText>
      <AppText variant="caption" muted numberOfLines={1}>
        {collection.detail ?? t("common.unknownArtist")} ·{" "}
        {tn("songs", collection.songs.length)}
      </AppText>
    </Pressable>
  );
});

const CollectionRow = memo(function CollectionRow({
  collection,
}: {
  collection: Collection;
}) {
  const colors = useTheme();
  const { t, tn } = useT();
  const isArtist = collection.kind === "artist";
  const title =
    collection.name ??
    (isArtist
      ? t("common.unknownArtist")
      : collection.kind === "folder"
        ? t("browse.unknownFolder")
        : t("common.unknownAlbum"));
  const subtitle = isArtist
    ? `${tn("albums", collection.albumCount)} · ${tn("songs", collection.songs.length)}`
    : `${tn("songs", collection.songs.length)} · ${formatTotalDuration(collection.totalMs)}`;

  return (
    <Pressable
      onPress={() => openCollection(collection.kind, collection.key)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surface : "transparent" },
      ]}
    >
      {collection.kind === "folder" ? (
        <View
          style={[styles.folderIcon, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="folder" size={24} color={colors.purple} />
        </View>
      ) : (
        <Cover collection={collection} size={52} round={isArtist} />
      )}
      <View style={styles.rowTexts}>
        <AppText weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {subtitle}
        </AppText>
        {collection.kind === "folder" && collection.detail ? (
          <AppText variant="label" color={colors.textFaint} numberOfLines={1}>
            {collection.detail}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
});

/** Home › Albums (2-column grid), Artists and Folders (lists). */
export function CollectionList({ kind, query, bottomSpace }: Props) {
  const { width } = useWindowDimensions();
  const { t, tn } = useT();
  const all = useCollections(kind);

  const items = useMemo(() => {
    if (!query) return all;
    return all.filter((c) =>
      `${c.name ?? ""} ${c.detail ?? ""}`.toLowerCase().includes(query),
    );
  }, [all, query]);

  const cellSize = Math.floor((width - SIDE * 2 - GRID_GAP) / 2);
  const countKey =
    kind === "album" ? "albums" : kind === "artist" ? "artists" : "folders";

  const renderAlbum = useCallback(
    ({ item, index }: { item: Collection; index: number }) => (
      <View
        style={[
          styles.gridItem,
          index % 2 === 0 ? styles.gridLeft : styles.gridRight,
        ]}
      >
        <AlbumCell collection={item} size={cellSize} />
      </View>
    ),
    [cellSize],
  );

  return (
    <FlashList
      key={kind}
      data={items}
      numColumns={kind === "album" ? 2 : 1}
      keyExtractor={(c) => `${c.kind}:${c.key}`}
      renderItem={
        kind === "album"
          ? renderAlbum
          : ({ item }) => <CollectionRow collection={item} />
      }
      ListHeaderComponent={
        <AppText variant="caption" muted style={styles.count}>
          {tn(countKey, items.length)}
        </AppText>
      }
      ListEmptyComponent={
        <AppText muted align="center" style={styles.empty}>
          {query ? t("home.noMatch") : t("home.noSongs")}
        </AppText>
      }
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  count: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  empty: {
    marginTop: 40,
    paddingHorizontal: 32,
  },
  gridItem: {
    flex: 1,
    marginBottom: 18,
  },
  gridLeft: {
    paddingLeft: SIDE,
    paddingRight: GRID_GAP / 2,
  },
  gridRight: {
    paddingLeft: GRID_GAP / 2,
    paddingRight: SIDE,
  },
  cell: {
    gap: 2,
  },
  cellTitle: {
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 68,
  },
  folderIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTexts: {
    flex: 1,
  },
});
