// import CustomVarExtensionVariableChipWidget from "../components/CustomVarExtensionVariableChipWidget.svelte";

export const CustomVarExtensionProps = {
    name: "variable",
    tagName: "var",
    tagAttributeName: "name",
    tagAttributeValue: "value",
    tagAttributeClass: "variable-chip",
    tagAttributeDataVariable: "data-variable",
    // nodeViewComponent: CustomVarExtensionVariableChipWidget,
    suggestion: {
        char: "@",
        startOfLine: false,
    }

}