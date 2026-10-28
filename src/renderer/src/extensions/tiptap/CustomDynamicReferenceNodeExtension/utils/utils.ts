import { CustomDesignExtensionProps } from "../../CustomDesignExtension/utils/common.utils";
import { CustomDesignExtensionComponents } from "../../CustomDesignExtension/utils/utils";
import { CustomChartExtensionProps } from "../../CustomChartExtension/utils/common.utils";
import { CustomChartExtensionComponents } from "../../CustomChartExtension/utils/utils";
import { CustomSlideExtensionProps } from "../../CustomSlideExtension/utils/common.utils";
import { CustomSlideExtensionComponents } from "../../CustomSlideExtension/utils/utils";
import { CustomSpreadsheetExtensionProps } from "../../CustomSpreadsheetExtension/utils/common.utils";
import { CustomSpreadsheetExtensionComponents } from "../../CustomSpreadsheetExtension/utils/utils";
import { CustomVarExtensionProps } from "../../CustomVarExtension/utils/common.utils";
import { CustomVarExtensionComponents } from "../../CustomVarExtension/utils/utils";

export type SuggestionItemsType = {
    id: string,
    text: string,
    html: string,
    rawHtml?: string,
    display: string,
    type: string,
    src?: string,
    editorId?: string,
    varTokens?: string[]
}
export const DYNAMIC_REFERENCE_RENDERING_NODE_COMPONENT_MAP: Record<string, any> = {
    [CustomSlideExtensionProps.name]: CustomSlideExtensionComponents.nodeView,
    [CustomSpreadsheetExtensionProps.name]: CustomSpreadsheetExtensionComponents.nodeView,
    [CustomChartExtensionProps.name]: CustomChartExtensionComponents.nodeView,
    // [CustomVarExtensionProps.name]: CustomVarExtensionComponents,
    [CustomVarExtensionProps.name]: CustomVarExtensionComponents.nodeView,
    [CustomDesignExtensionProps.name]: CustomDesignExtensionComponents.nodeView,
    //   'aiExtension': CustomAIExtension,
};
