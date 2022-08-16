import React, { useEffect, useRef, useState } from "react";
import PubSub from "pubsub-js";
import DiagramCanvas from "./diagram/DiagramCanvas";
import { getCommonEvent } from "../common/events";
import { atom, useAtom } from "jotai";
import { ContextMenu } from "../common/Menus";
import Progress from "../common/Progress";
import Printer from "../common/Printer";

const canUndoAtom = atom(false);
export const useCanUndo = () => useAtom(canUndoAtom);

export const canRedoAtom = atom(false);
export const useCanRedo = () => useAtom(canRedoAtom);

export const canPopDiagramAtom = atom(false);
export const editModeAtom = atom(false);

const selectModeAtom = atom(false);
export const useSelectMode = () => useAtom(selectModeAtom);

const diagramNameAtom = atom("System");
export const useDiagramName = () => useAtom(diagramNameAtom);

// @ts-ignore
export default function Diagram({ width, height }) {
  // The ref to the canvas handler for all canvas operations
  const canvasRef = useRef(null);
  const [contextMenu, setContextMenu] = useState<any>();
  const [, setTitle] = useDiagramName();
  const [, setCanUndo] = useAtom(canUndoAtom);
  const [, setCanRedo] = useAtom(canRedoAtom);
  const [, setCanPopDiagram] = useAtom(canPopDiagramAtom);
  const [, setEditMode] = useAtom(editModeAtom);
  const [, setSelectMode] = useAtom(selectModeAtom);

  // Enable print key
  useEffect(() => {
    document.title = "Dependitor";
    const handler = Printer.registerPrintKey(() =>
      PubSub.publish("canvas.Print")
    );
    return () => Printer.deregisterPrintKey(handler);
  });

  useEffect(() => {
    const callbacks = {
      setTitle: setTitle,
      setCanUndo: setCanUndo,
      setCanRedo: setCanRedo,
      setCanPopDiagram: setCanPopDiagram,
      setEditMode: setEditMode,
      setSelectMode: setSelectMode,
      setContextMenu: setContextMenu,
    };

    const canvas = new DiagramCanvas("canvas", callbacks);
    // @ts-ignore
    canvasRef.current = canvas;
    canvas.init();

    const contextMenuHandler = enableContextMenu(
      "canvas",
      setContextMenu,
      canvas
    );

    return () => {
      // Clean initialization
      PubSub.unsubscribe("diagram");
      var el = document.getElementById("canvas");
      el?.removeEventListener("contextmenu", contextMenuHandler);
      document.removeEventListener("longclick", contextMenuHandler);
      // @ts-ignore
      canvasRef.current.delete();
    };
  }, [
    setCanUndo,
    setCanRedo,
    setCanPopDiagram,
    setEditMode,
    setSelectMode,
    setTitle,
  ]);

  return (
    <>
      <Progress />

      <div id="diagram">
        <div
          id="canvas"
          style={{
            width: width,
            height: height,
            maxWidth: width,
            maxHeight: height,
            position: "absolute",
            overflow: "scroll",
          }}
        />
        <div
          id="canvasPrint"
          style={{
            width: 0,
            height: 0,
            maxWidth: 0,
            maxHeight: 0,
            position: "absolute",
            overflow: "hidden",
          }}
        />
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </>
  );
}

function enableContextMenu(
  elementId: string,
  _setContextMenu: any,
  _canvas: DiagramCanvas
) {
  const handleContextMenu = (event: any) => {
    //console.log('right', event)
    if (event.type === "longclick") {
      // long click event from Canvas to simulate context menu on touch device
      event = event.detail;
    } else {
      // Normal contextmenu event
      event.preventDefault();
      event = getCommonEvent(event);
    }
  };

  var el = document.getElementById(elementId);
  el?.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("longclick", handleContextMenu);
  return handleContextMenu;
}
