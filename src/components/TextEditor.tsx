import { forwardRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface TextEditorProps {
  value: string;
  onChange: (content: string) => void;
  height?: number;
}

const TextEditor = forwardRef<any, TextEditorProps>(({ value, onChange, height = 500 }, ref) => {
  return (
    <div className="w-full">
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        onInit={(_evt: unknown, editor: any) => {
          if (typeof ref === 'function') {
            ref(editor);
          } else if (ref) {
            ref.current = editor;
          }
        }}
        value={value}
        onEditorChange={onChange}
        init={{
          menubar: true,
          branding: false,
          height: height,
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
          ],
          toolbar:
            'undo redo | blocks | ' +
            'bold italic forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
          extended_valid_elements: 'iframe[src|width|height|frameborder|style|allowfullscreen],object[data|type|width|height|style|class],embed[src|type|width|height|style|class],param[name|value]',
          valid_children: '+body[iframe],+div[iframe],+p[iframe],+div[object],+body[object]',
          verify_html: false,
          media_live_embeds: true,
          convert_urls: false,
          allow_script_urls: true
        }}
      />
    </div>
  );
});

TextEditor.displayName = 'TextEditor';
export default TextEditor;
