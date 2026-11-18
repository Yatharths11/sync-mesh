import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import * as Y from 'yjs';

import { diffStrings } from '../../utilities';
import { useTheme } from '../../theme';

export function CollaborativeTextInput({
  ydoc,
  props,
}: Readonly<{ ydoc: Y.Doc; props: object }>) {
  const { colors, typography } = useTheme();
  const { style: styleOverride, ...restProps } = props as { style?: object };
  const ytext = ydoc.getText('content');
  const [value, setValue] = useState<string>(ytext.toString());

  useEffect(() => {
    const observer = () => {
      setValue(ytext.toString());
    };
    ytext.observe(observer);
    return () => {
      ytext.unobserve(observer);
    };
  }, [ytext]);

  function handleChangeText(newText: string) {
    const { position, deletedLength, insertedText } = diffStrings(
      value,
      newText,
    );

    if (deletedLength) ytext.delete(position, deletedLength);
    if (insertedText) ytext.insert(position, insertedText);
  }

  return (
    <TextInput
      value={value}
      onChangeText={handleChangeText}
      multiline
      autoFocus
      style={[
        { ...typography.editor, color: colors.textPrimary, backgroundColor: colors.background },
        styleOverride,
      ]}
      {...restProps}
    />
  );
}
