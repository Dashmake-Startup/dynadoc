// import * as FluentUI from '@fluentui/react-components'
// component-packs/fluent/index.ts


import {
    Button,
    Input,
    Checkbox,
    RadioGroup,
    Select,
    Slider,
    Switch,
    // DatePicker,
} from '@fluentui/react-components'
import { DatePicker } from '@fluentui/react-datepicker-compat';

import {
    Button as AntButton,
    Input as AntInput,
    Checkbox as AntCheckbox,
    Radio as AntRadio,
    Select as AntSelect,
    Slider as AntSlider,
    Switch as AntSwitch,
    DatePicker as AntDatePicker,
} from 'antd'

import {
    Button as MuiButton,
    TextField as MuiTextField,
    Checkbox as MuiCheckbox,
    Radio as MuiRadio,
    RadioGroup as MuiRadioGroup,
    FormControlLabel,
    Select as MuiSelect,
    MenuItem,
    Slider as MuiSlider,
    Switch as MuiSwitch,
    // DatePicker as MuiDatePicker
} from '@mui/material'
// successfull installation using `npm cache clean --force && npm install @mui/x-date-pickers --legacy-peer-deps`
//     "@mui/x-date-pickers": "^8.23.0",
// import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';

import React from 'react'

// import { DatePicker } from '@fluentui/react' // v8 (optional)
// import * as Antd from 'antd'
// import * as MUI from '@mui/material'
// export { FluentUI }

export type FormComponentFrameWork =
    'svelte' | 'react' | 'vue'
export const FormComponentFrameWorks = {
    svelte: 'svelte', react: 'react', vue: 'vue'
}

// export type FormComponentPack =
//     'fluent' | 'antd' | 'mui'
export const FormComponentPacks = {
    fluent: 'fluent', antd: 'antd', mui: 'mui'
}
export const FormComponentNames = {
    // Button: 'Button'
    Button: 'Button', TextField: 'TextField', Checkbox: 'Checkbox',
    RadioGroup: 'RadioGroup', Select: 'Select', DatePicker: 'DatePicker',
    Slider: 'Slider', Switch: 'Switch'
}


export const fluent2 = {
    [FormComponentNames.Button]: {
        component: Button,
    },
    [FormComponentNames.TextField]: {
        component: Input, // ✅ correct
    },
    [FormComponentNames.Checkbox]: {
        component: Checkbox,
    },
    [FormComponentNames.RadioGroup]: {
        component: RadioGroup,
    },
    [FormComponentNames.Select]: {
        component: Select,
    },
    [FormComponentNames.DatePicker]: {
        component: Select,
        // component: DatePicker,
    },
    [FormComponentNames.Slider]: {
        component: Slider,
    },
    [FormComponentNames.Switch]: {
        component: Switch,
    },
}

export const fluent = {
    [FormComponentNames.Button]: {
        component: Button,
        mapAttrs: (attrs) => ({
            appearance: attrs.appearance,
            disabled: attrs.disabled,
            children: attrs.label, // ✅ Button uses children
        }),
    },

    [FormComponentNames.TextField]: {
        component: Input,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            placeholder: attrs.label ?? attrs.placeholder,
            disabled: attrs.disabled,
            name: attrs.name,
        }),
    },

    [FormComponentNames.Checkbox]: {
        component: Checkbox,
        mapAttrs: (attrs) => ({
            label: attrs.label, // ✅ Checkbox has label prop
            checked: attrs.checked,
            disabled: attrs.disabled,
            name: attrs.name,
        }),
    },

    /* [FormComponentNames.RadioGroup]: {
        component: RadioGroup,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            name: attrs.name,
            disabled: attrs.disabled,
            children: attrs.options?.map((opt) => (
                // <Radio key= { opt.value } value = { opt.value } label = { opt.label } />
                ""
            )),
        }),
    }, */
    [FormComponentNames.RadioGroup]: {
        component: RadioGroup,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            name: attrs.name,
            disabled: attrs.disabled,
            children: Array.isArray(attrs.options)
                ? attrs.options.map((opt) =>
                    React.createElement("Radio", {
                        key: opt.value,
                        value: opt.value,
                        label: opt.label,
                        disabled: attrs.disabled,
                    })
                )
                : null,
        }),
    },

    /* [FormComponentNames.Select]: {
        component: Select,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
            children: !isArray(attrs?.options ?) ? attrs?.options ?: attrs?.options?.map((opt) => (
                ''
                // <option key= { opt.value } value = { opt.value } >
                // { opt.label }
                // </option>
            )),
        }),
    }, */

    [FormComponentNames.Select]: {
        component: Select,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
            children: Array.isArray(attrs.options)
                ? attrs.options.map((opt) =>
                    React.createElement(
                        'option',
                        { key: opt.value, value: opt.value },
                        opt.label
                    )
                )
                : null,
        }),
    },

    [FormComponentNames.DatePicker]: {
        component: DatePicker, // placeholder until DatePicker used
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
        }),
    },

    [FormComponentNames.Slider]: {
        component: Slider,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            min: attrs.min,
            max: attrs.max,
            step: attrs.step,
            disabled: attrs.disabled,
        }),
    },

    [FormComponentNames.Switch]: {
        component: Switch,
        mapAttrs: (attrs) => ({
            checked: attrs.checked,
            disabled: attrs.disabled,
            label: attrs.label,
        }),
    },
}

export const antd = {
    [FormComponentNames.Button]: {
        component: AntButton,
        mapAttrs: (attrs) => ({
            type: attrs.appearance ?? 'default',
            disabled: attrs.disabled,
            children: attrs.label,
        }),
    },

    [FormComponentNames.TextField]: {
        component: AntInput,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            placeholder: attrs.label ?? attrs.placeholder,
            disabled: attrs.disabled,
            name: attrs.name,
        }),
    },

    [FormComponentNames.Checkbox]: {
        component: AntCheckbox,
        mapAttrs: (attrs) => ({
            checked: attrs.checked,
            disabled: attrs.disabled,
            name: attrs.name,
            children: attrs.label, // ✅ antd checkbox label via children
        }),
    },

    [FormComponentNames.RadioGroup]: {
        component: AntRadio.Group,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            name: attrs.name,
            disabled: attrs.disabled,
            children: Array.isArray(attrs.options)
                ? attrs.options.map((opt) =>
                    React.createElement(
                        AntRadio,
                        { key: opt.value, value: opt.value, disabled: attrs.disabled },
                        opt.label
                    )
                )
                : null,
        }),
    },

    [FormComponentNames.Select]: {
        component: AntSelect,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
            options: Array.isArray(attrs.options)
                ? attrs.options.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                }))
                : [],
        }),
    },

    [FormComponentNames.DatePicker]: {
        component: AntDatePicker,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
        }),
    },

    [FormComponentNames.Slider]: {
        component: AntSlider,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            min: attrs.min,
            max: attrs.max,
            step: attrs.step,
            disabled: attrs.disabled,
        }),
    },

    [FormComponentNames.Switch]: {
        component: AntSwitch,
        mapAttrs: (attrs) => ({
            checked: attrs.checked,
            disabled: attrs.disabled,
        }),
    },
}


export const mui = {
    [FormComponentNames.Button]: {
        component: MuiButton,
        mapAttrs: (attrs) => ({
            variant: attrs.appearance ?? 'contained',
            disabled: attrs.disabled,
            children: attrs.label,
        }),
    },

    [FormComponentNames.TextField]: {
        component: MuiTextField,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            label: attrs.label,
            placeholder: attrs.placeholder,
            disabled: attrs.disabled,
            name: attrs.name,
            fullWidth: true,
        }),
    },

    [FormComponentNames.Checkbox]: {
        component: FormControlLabel,
        mapAttrs: (attrs) => ({
            label: attrs.label,
            control: React.createElement(MuiCheckbox, {
                checked: attrs.checked,
                disabled: attrs.disabled,
                name: attrs.name,
            }),
        }),
    },

    /* [FormComponentNames.DatePicker]: {
        component: FormControlLabel,
        mapAttrs: (attrs) => ({
            // label: attrs.label,
            value: attrs.value,
            control: React.createElement(MuiDatePicker, {
                // checked: attrs.checked,
                disabled: attrs.disabled,
                name: attrs.name,
            }),
        }),
    }, */

    [FormComponentNames.RadioGroup]: {
        component: RadioGroup,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            name: attrs.name,
            children: Array.isArray(attrs.options)
                ? attrs.options.map((opt) =>
                    React.createElement(FormControlLabel, {
                        key: opt.value,
                        value: opt.value,
                        label: opt.label,
                        control: React.createElement(MuiRadio, {
                            disabled: attrs.disabled,
                        }),
                    })
                )
                : null,
        }),
    },

    [FormComponentNames.Select]: {
        component: MuiSelect,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            disabled: attrs.disabled,
            children: Array.isArray(attrs.options)
                ? attrs.options.map((opt) =>
                    React.createElement(
                        MenuItem,
                        { key: opt.value, value: opt.value },
                        opt.label
                    )
                )
                : null,
        }),
    },

    [FormComponentNames.Slider]: {
        component: MuiSlider,
        mapAttrs: (attrs) => ({
            value: attrs.value,
            min: attrs.min,
            max: attrs.max,
            step: attrs.step,
            disabled: attrs.disabled,
        }),
    },

    [FormComponentNames.Switch]: {
        component: FormControlLabel,
        mapAttrs: (attrs) => ({
            label: attrs.label,
            control: React.createElement(MuiSwitch, {
                checked: attrs.checked,
                disabled: attrs.disabled,
            }),
        }),
    },
}





export const ComponentPacks = {
    //   fluent: () => import('./component-packs/fluent'),
    [FormComponentFrameWorks.react]: {
        // fluent: () => FluentUI,
        fluent: () => fluent,
        antd: () => antd,
        mui: () => mui,
    }
    //   antd: () => import('./component-packs/antd'),
    //   mui: () => import('./component-packs/mui')
}

/* export async function loadComponents(framework, packName) {
    const mod = await ComponentPacks[framework][packName]()
    console.log("comp-----", Object.keys(mod))
    return mod
    // return Object.keys(mod)
} */


