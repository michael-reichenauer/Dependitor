import cuid from "cuid";
import Result, { isError } from "../../common/Result";
import assert from "assert";
import { di, singleton, diKey } from "../../common/di";
import { IStoreDBKey, MergeEntity } from "../../common/db/StoreDB";
import {
  ApplicationDto,
  applicationKey,
  CanvasDto,
  DiagramDto,
  DiagramInfoDto,
} from "./StoreDtos";
import { LocalEntity } from "../../common/db/LocalDB";
import { RemoteEntity } from "../../common/db/RemoteDB";
import { NotFoundError } from "../../common/CustomError";

// IStore handles storage of diagrams
export const IStoreKey = diKey<IStore>();
export interface IStore {
  configure(config: Partial<Configuration>): void;
  isSyncEnabledOk(): boolean;
  triggerSync(): Promise<Result<void>>;

  openNewDiagram(): DiagramDto;
  tryOpenMostResentDiagram(): Promise<Result<DiagramDto>>;
  tryOpenDiagram(diagramId: string): Promise<Result<DiagramDto>>;

  setDiagramName(name: string): void;
  exportDiagram(): DiagramDto; // Used for print or export

  getRootCanvas(): CanvasDto;
  tryGetCanvas(canvasId: string): Result<CanvasDto>;
  getCanvas(canvasId: string): CanvasDto;
  writeCanvas(canvas: CanvasDto): void;
  deleteCanvas(canvasId: string): void;

  getMostResentDiagramId(): Result<string>;
  getRecentDiagrams(): DiagramInfoDto[];

  deleteDiagram(diagramId: string): void;
}

export interface Configuration {
  onRemoteChanged: (keys: string[]) => void;
  onSyncChanged: (isOK: boolean, error?: Error) => void;
  isSyncEnabled: boolean;
}

const rootCanvasId = "root";
const defaultApplicationDto: ApplicationDto = {
  diagramInfos: {},
  deletedDiagrams: [],
};
const defaultDiagramDto: DiagramDto = { id: "", name: "", canvases: {} };

@singleton(IStoreKey)
export class Store implements IStore {
  private currentDiagramId: string = "";
  private config: Configuration = {
    onRemoteChanged: () => {},
    onSyncChanged: () => {},
    isSyncEnabled: false,
  };

  constructor(private db = di(IStoreDBKey)) {}

  public isSyncEnabledOk(): boolean {
    return this.db.isSyncEnabledOk();
  }

  public configure(config: Partial<Configuration>): void {
    this.config = { ...this.config, ...config };

    this.db.configure({
      onConflict: (local: LocalEntity, remote: RemoteEntity) =>
        this.onEntityConflict(local, remote),
      ...config,
      onRemoteChanged: (keys: string[]) => this.onRemoteChange(keys),
    });
  }

  public triggerSync(): Promise<Result<void>> {
    return this.db.triggerSync();
  }

  public openNewDiagram(): DiagramDto {
    const now = Date.now();
    const id = cuid();
    const name = this.getUniqueName();
    console.log("new diagram", id, name);

    const diagramDto: DiagramDto = {
      id: id,
      name: name,
      canvases: {},
    };

    const applicationDto = this.getApplicationDto();
    applicationDto.diagramInfos[id] = {
      id: id,
      name: name,
      accessed: now,
    };

    this.db.monitorRemoteEntities([id, applicationKey]);
    this.db.writeBatch([
      { key: applicationKey, value: applicationDto },
      { key: id, value: diagramDto },
    ]);

    this.currentDiagramId = id;
    return diagramDto;
  }

  public async tryOpenMostResentDiagram(): Promise<Result<DiagramDto>> {
    const id = this.getMostResentDiagramId();
    if (isError(id)) {
      return id;
    }

    const diagramDto = await this.db.tryReadLocalThenRemote<DiagramDto>(id);
    if (isError(diagramDto)) {
      return diagramDto;
    }

    this.db.monitorRemoteEntities([id, applicationKey]);
    this.currentDiagramId = id;

    return diagramDto;
  }

  public async tryOpenDiagram(id: string): Promise<Result<DiagramDto>> {
    const diagramDto = await this.db.tryReadLocalThenRemote<DiagramDto>(id);
    if (isError(diagramDto)) {
      return diagramDto;
    }

    this.db.monitorRemoteEntities([id, applicationKey]);
    this.currentDiagramId = id;

    // Too support most recently used diagram feature, we update accessed time
    const applicationDto = this.getApplicationDto();
    const diagramInfo = applicationDto.diagramInfos[id];
    applicationDto.diagramInfos[id] = { ...diagramInfo, accessed: Date.now() };
    this.db.writeBatch([{ key: applicationKey, value: applicationDto }]);

    return diagramDto;
  }

  public getRootCanvas(): CanvasDto {
    return this.getCanvas(rootCanvasId);
  }

  public getCanvas(canvasId: string): CanvasDto {
    const diagramDto = this.getDiagramDto();

    const canvasDto = diagramDto.canvases[canvasId];
    assert(canvasDto);

    return canvasDto;
  }

  public deleteCanvas(canvasId: string): void {
    const diagramDto = this.getDiagramDto();
    const diagramId = diagramDto.id;

    if (!diagramDto.canvases[canvasId]) {
      return;
    }

    delete diagramDto.canvases[canvasId];
    this.db.writeBatch([{ key: diagramId, value: diagramDto }]);
  }

  public tryGetCanvas(canvasId: string): Result<CanvasDto> {
    const diagramDto = this.getDiagramDto();

    const canvasDto = diagramDto.canvases[canvasId];
    if (!canvasDto) {
      return new NotFoundError(
        `Canvas ${canvasId} not in diagram ${diagramDto.id}`
      );
    }

    return canvasDto;
  }

  public writeCanvas(canvasDto: CanvasDto): void {
    const diagramDto = this.getDiagramDto();
    const diagramId = diagramDto.id;

    diagramDto.canvases[canvasDto.id] = canvasDto;

    this.db.writeBatch([{ key: diagramId, value: diagramDto }]);
  }

  public getRecentDiagrams(): DiagramInfoDto[] {
    return Object.values(this.getApplicationDto().diagramInfos).sort((i1, i2) =>
      i1.accessed < i2.accessed ? 1 : i1.accessed > i2.accessed ? -1 : 0
    );
  }

  // For printing/export
  public exportDiagram(): DiagramDto {
    return this.getDiagramDto();
  }

  public deleteDiagram(id: string): void {
    console.log("Delete diagram", id);

    const applicationDto = this.getApplicationDto();
    delete applicationDto.diagramInfos[id];
    if (!applicationDto.deletedDiagrams.includes(id)) {
      applicationDto.deletedDiagrams.push(id);
    }

    this.db.writeBatch([{ key: applicationKey, value: applicationDto }]);
    this.db.removeBatch([id]);
  }

  public setDiagramName(name: string): void {
    const diagramDto = this.getDiagramDto();
    const id = diagramDto.id;
    diagramDto.name = name;

    const applicationDto = this.getApplicationDto();
    applicationDto.diagramInfos[id] = {
      ...applicationDto.diagramInfos[id],
      name: name,
      accessed: Date.now(),
    };

    this.db.writeBatch([
      { key: applicationKey, value: applicationDto },
      { key: id, value: diagramDto },
    ]);
  }

  public getMostResentDiagramId(): Result<string> {
    const resentDiagrams = this.getRecentDiagrams();
    if (resentDiagrams.length === 0) {
      return new RangeError("not found");
    }

    return resentDiagrams[0].id;
  }

  public getApplicationDto(): ApplicationDto {
    const dto = this.db.readLocal<ApplicationDto>(
      applicationKey,
      defaultApplicationDto
    );
    if (dto.deletedDiagrams == null) {
      dto.deletedDiagrams = [];
    }

    return dto;
  }

  private onRemoteChange(keys: string[]) {
    console.log("onRemoteChange", keys);
    this.config.onRemoteChanged(keys);
  }

  private onEntityConflict(
    local: LocalEntity,
    remote: RemoteEntity
  ): MergeEntity {
    if ("diagramInfos" in local.value) {
      return this.onApplicationConflict(local, remote);
    }
    return this.onDiagramConflict(local, remote);
  }

  private onApplicationConflict(
    local: LocalEntity,
    remote: RemoteEntity
  ): MergeEntity {
    console.warn("Application conflict", local, remote);

    const key = local.key;
    const localApp = local.value as ApplicationDto;
    const remoteApp = remote.value as ApplicationDto;
    localApp.deletedDiagrams =
      localApp.deletedDiagrams == null ? [] : localApp.deletedDiagrams;
    remoteApp.deletedDiagrams =
      remoteApp.deletedDiagrams == null ? [] : remoteApp.deletedDiagrams;

    // Merge removed diagrams to ensure that diagrams are removed in both locations
    const removed: string[] = [];
    remoteApp.deletedDiagrams.forEach((id) => {
      if (!localApp.deletedDiagrams.includes(id)) {
        localApp.deletedDiagrams.push(id);
        delete localApp.diagramInfos[id];
        removed.push(id);
      }
    });
    localApp.deletedDiagrams.forEach((id) => {
      if (!remoteApp.deletedDiagrams.includes(id)) {
        remoteApp.deletedDiagrams.push(id);
        delete remoteApp.diagramInfos[id];
        removed.push(id);
      }
    });
    setTimeout(() => this.db.removeBatch(removed), 0);

    // Merger diagram infos
    if (local.version >= remote.version) {
      // Local entity has more edits, merge diagram infos, but priorities local
      const diagramInfos = {
        ...remoteApp.diagramInfos,
        ...localApp.diagramInfos,
      };
      const applicationDto: ApplicationDto = {
        diagramInfos: diagramInfos,
        deletedDiagrams: localApp.deletedDiagrams,
      };

      return {
        key: key,
        value: applicationDto,
        version: local.version,
      };
    }

    // Remote entity since that has more edits, merge diagram infos, but priorities remote
    const diagramInfos = {
      ...localApp.diagramInfos,
      ...remoteApp.diagramInfos,
    };
    const applicationDto: ApplicationDto = {
      diagramInfos: diagramInfos,
      deletedDiagrams: remoteApp.deletedDiagrams,
    };

    return {
      key: key,
      value: applicationDto,
      version: remote.version,
    };
  }

  private onDiagramConflict(
    local: LocalEntity,
    remote: RemoteEntity
  ): MergeEntity {
    console.warn("Diagram conflict", local, remote);
    if (local.version >= remote.version) {
      // use local since it has more edits
      return {
        key: local.key,
        value: local.value,
        version: local.version,
      };
    }

    // Use remote entity since that has more edits
    return {
      key: remote.key,
      value: remote.value,
      version: remote.version,
    };
  }

  private getDiagramDto(): DiagramDto {
    return this.db.readLocal<DiagramDto>(
      this.currentDiagramId,
      defaultDiagramDto
    );
  }

  private getUniqueName(): string {
    const diagrams = Object.values(this.getApplicationDto().diagramInfos);

    for (let i = 0; i < 99; i++) {
      const name = "Name" + (i > 0 ? ` (${i})` : "");
      if (!diagrams.find((d) => d.name === name)) {
        return name;
      }
    }

    return "Name";
  }
}

// public async loadDiagramFromFile(): Promise<Result<string>> {
//   const fileText = await this.localFiles.loadFile();
//   if (isError(fileText)) {
//     return fileText;
//   }
//   const fileDto: FileDto = JSON.parse(fileText);

//   // if (!(await this.sync.uploadDiagrams(fileDto.diagrams))) {
//   //   // save locally
//   //   fileDto.diagrams.forEach((d: DiagramDto) => this.local.writeDiagram(d));
//   // }

//   //fileDto.diagrams.forEach((d: DiagramDto) => this.local.writeDiagram(d));

//   const firstDiagramId = fileDto.diagrams[0]?.id;
//   if (!firstDiagramId) {
//     return new Error("No valid diagram in file");
//   }
//   return firstDiagramId;
// }

// public saveDiagramToFile(): void {
//   const diagramDto = this.getDiagramDto();

//   const fileDto: FileDto = { diagrams: [diagramDto] };
//   const fileText = JSON.stringify(fileDto, null, 2);
//   this.localFiles.saveFile(`${diagramDto.name}.json`, fileText);
// }

// public async saveAllDiagramsToFile(): Promise<void> {
//   // let diagrams = await this.sync.downloadAllDiagrams();
//   // if (!diagrams) {
//   //   // Read from local
//   //   diagrams = this.local.readAllDiagrams();
//   // }
//   //   let diagrams = this.local.readAllDiagrams();
//   //   const fileDto = { diagrams: diagrams };
//   //   const fileText = JSON.stringify(fileDto, null, 2);
//   //   this.localFiles.saveFile(`diagrams.json`, fileText);
// }
