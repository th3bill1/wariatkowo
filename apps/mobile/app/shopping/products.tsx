import { Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import type { ShoppingProduct } from "../../../../shared/models";
import { useAuth } from "../../src/AuthProvider";
import { formatPolishDate } from "../../src/date";
import { colors } from "../../src/theme";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  State,
  s,
} from "../../src/ui";

export default function ProductHistoryScreen() {
  const { api } = useAuth();
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"frequency" | "recent">("frequency");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = setTimeout(
      () =>
        void api.shopping
          .products(query, sort)
          .then((value) => {
            if (current) {
              setProducts(value);
              setError(null);
            }
          })
          .catch((reason) => current && setError(reason.message))
          .finally(() => current && setLoading(false)),
      140,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, query, sort]);
  const refresh = () => {
    setLoading(true);
    void api.shopping
      .products(query, sort)
      .then((value) => {
        setProducts(value);
        setError(null);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  };
  const remove = (product: ShoppingProduct) =>
    Alert.alert("Usunąć z podpowiedzi?", product.name, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () =>
          void api.shopping
            .removeProduct(product.id)
            .then(() =>
              setProducts((current) =>
                current.filter((value) => value.id !== product.id),
              ),
            )
            .catch((reason) => setError(reason.message)),
      },
    ]);
  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={colors.purple}
        />
      }
    >
      <PageHeader
        description="Produkty, których Wariatkowo nauczyło się z list zakupów."
        eyebrow="Zakupy"
        title="Historia produktów"
      />
      <Card>
        <Field
          label="Szukaj"
          onChangeText={setQuery}
          placeholder="Mleko…"
          value={query}
        />
        <View style={s.chips}>
          <Chip
            label="Najczęściej dodawane"
            onPress={() => setSort("frequency")}
            selected={sort === "frequency"}
          />
          <Chip
            label="Ostatnio używane"
            onPress={() => setSort("recent")}
            selected={sort === "recent"}
          />
        </View>
      </Card>
      <State
        error={error}
        loading={loading}
        loadingLabel="Szukamy produktów…"
        onRetry={refresh}
      />
      {!loading && !products.length ? (
        <Card>
          <EmptyState
            description="Historia pojawi się po dodaniu pierwszego produktu."
            title="Brak produktów"
          />
        </Card>
      ) : null}
      {products.length ? (
        <Card>
          {products.map((product) => (
            <View key={product.id} style={s.listRow}>
              <View style={s.spaceBetween}>
                <View style={s.grow}>
                  <Text style={s.label}>{product.name}</Text>
                  <Text style={s.meta}>
                    Dodawane: {product.timesAdded}{" "}
                    {product.timesAdded === 1 ? "raz" : "razy"} · ostatnio{" "}
                    {formatPolishDate(product.lastAddedAt)}
                  </Text>
                  {product.defaultCategory ? (
                    <Text style={s.badge}>{product.defaultCategory}</Text>
                  ) : null}
                </View>
                <Button
                  accessibilityLabel={`Usuń ${product.name} z podpowiedzi`}
                  compact
                  Icon={Trash2}
                  onPress={() => remove(product)}
                  title="Usuń"
                  variant="danger"
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
