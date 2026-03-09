import { useAppController } from "./app/controller/useAppController.js";
import { AppView } from "./app/view/AppView.js";

function App() {
  const model = useAppController();
  return <AppView {...model} />;
}

export default App;
