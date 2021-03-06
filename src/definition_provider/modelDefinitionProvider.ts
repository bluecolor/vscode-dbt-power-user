import {
  DefinitionProvider,
  Definition,
  Uri,
  TextDocument,
  CancellationToken,
  ProviderResult,
  DefinitionLink,
  Location,
  Position,
  Range,
} from "vscode";
import {
  ManifestCacheChangedEvent,
  OnManifestCacheChanged,
} from "../manifest/manifestCacheChangedEvent";
import { NodeMetaMap } from "../domain";
import { manifestContainer } from "../manifest/manifestContainer";

export class ModelDefinitionProvider
  implements DefinitionProvider, OnManifestCacheChanged {
  private modelToLocationMap: Map<string, NodeMetaMap> = new Map();
  private static readonly IS_REF = /(ref)\([^)]*\)/;
  private static readonly GET_DBT_MODEL = /(?!'|")([^(?!'|")]*)(?='|")/gi;

  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Definition | DefinitionLink[]> {
    return new Promise((resolve, reject) => {
      const hover = document.getText(document.getWordRangeAtPosition(position));
      const word = document.getText(
        document.getWordRangeAtPosition(
          position,
          ModelDefinitionProvider.IS_REF
        )
      );
      if (word !== undefined && hover !== "ref") {
        const dbtModel = word.match(ModelDefinitionProvider.GET_DBT_MODEL);
        if (dbtModel && dbtModel.length === 1) {
          const definition = this.getDefinitionFor(
            dbtModel[0],
            document.uri
          );
          resolve(definition);
          return;
        }
      }
      reject();
    });
  }

  onManifestCacheChanged(event: ManifestCacheChangedEvent): void {
    this.modelToLocationMap.set(event.projectRoot.fsPath, event.nodeMetaMap);
  }

  private getDefinitionFor(
    name: string,
    currentFilePath: Uri
  ): Definition | undefined {
    const projectRootpath = manifestContainer.getProjectRootpath(
      currentFilePath
    );
    if (projectRootpath === undefined) {
      return;
    }
    const nodeMap = this.modelToLocationMap.get(projectRootpath.fsPath);
    if (nodeMap === undefined) {
      return;
    }
    const location = nodeMap.get(name);
    if (location) {
      return new Location(Uri.file(location.path), new Range(0, 0, 0, 0));
    }
    return undefined;
  }
}
