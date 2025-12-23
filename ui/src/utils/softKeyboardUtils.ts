// Copyright (C) 2025 Langning Chen
// 
// This file is part of miniapp.

type Getter = () => string;
type Setter = (value: string) => void;

/**
 * 将软键盘返回的任意数据统一规整为 string
 * —— 这是防止出现 [object Object] 的关键
 */
function normalizeKeyboardInput(input: any): string {
    if (typeof input === 'string') {
        return input;
    }

    if (input && typeof input === 'object') {
        // 常见软键盘数据结构兜底
        if (typeof input.value === 'string') return input.value;
        if (typeof input.text === 'string') return input.text;
        if (typeof input.key === 'string') return input.key;
        if (typeof input.char === 'string') return input.char;
    }

    return '';
}

/**
 * 打开软键盘
 * @param getter 获取当前输入内容
 * @param setter 设置输入内容（只允许 string）
 */
export function openSoftKeyboard(getter: Getter, setter: Setter) {
    // 这里假设你是通过 $falcon 或某个原生接口打开软键盘
    // 根据你的项目实际 API 名称调整即可

    $falcon.trigger('open_soft_keyboard', {
        value: getter(),

        /**
         * 输入回调
         */
        onInput: (raw: any) => {
            const value = normalizeKeyboardInput(raw);
            setter(value);
        },

        /**
         * 删除回调（如果你的软键盘有）
         */
        onDelete: () => {
            const current = getter();
            setter(current.slice(0, -1));
        },

        /**
         * 确认 / 完成
         */
        onConfirm: (raw: any) => {
            const value = normalizeKeyboardInput(raw);
            setter(value);
        },

        /**
         * 关闭
         */
        onClose: () => {
            // 可选：什么都不做
        }
    });
}
