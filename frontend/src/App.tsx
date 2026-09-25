import { BrowserRouter } from "react-router-dom";
import { StudioShell } from "@/components/studio/StudioPage";
import { StudioProvider } from "@/studio/StudioContext";

export default function App() {
  return (
    <BrowserRouter>
      <StudioProvider>
        <StudioShell />
      </StudioProvider>
    </BrowserRouter>
  );
}
