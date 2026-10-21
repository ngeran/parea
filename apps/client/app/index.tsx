// The "/" route is only seen for a blink — Gate (in _layout) immediately
// replaces it with /welcome or /home. It renders the background color only.
import { View } from "react-native";
import { useTheme } from "../src/theme";

export default function Index() {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.bg }} />;
}
