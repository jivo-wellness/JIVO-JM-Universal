import { requireNativeView } from "expo";
import * as React from "react";
const NativeTextInputWrapper = requireNativeView("ExpoPasteInput");
export const TextInputWrapperView = React.forwardRef((props, ref) => {
    const { onPaste, children, ...viewProps } = props;
    const handlePaste = React.useCallback((event) => {
        if (onPaste) {
            // Expo View events wrap the payload in nativeEvent
            onPaste(event.nativeEvent);
        }
    }, [onPaste]);
    return (<NativeTextInputWrapper ref={ref} onPaste={handlePaste} {...viewProps}>
      {children}
    </NativeTextInputWrapper>);
});
TextInputWrapperView.displayName = "TextInputWrapperView";
//# sourceMappingURL=TextInputWrapperView.js.map