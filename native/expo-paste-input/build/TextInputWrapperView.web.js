import * as React from "react";
import { View } from "react-native";
export const TextInputWrapperView = React.forwardRef((props, ref) => {
    const { onPaste, ...viewProps } = props;
    return (<View ref={ref} {...viewProps}>
      {props.children}
    </View>);
});
TextInputWrapperView.displayName = "TextInputWrapperView";
//# sourceMappingURL=TextInputWrapperView.web.js.map