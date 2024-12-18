import { useState } from 'react';

interface FileRequirement {
  name: string;
  required: boolean;
  file?: File;
  assignedType?: 'constituents' | 'donations' | 'emails';
}

function App() {
  const [files, setFiles] = useState<FileRequirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<{
    constituents: Array<Record<string, string>>;
    tags: Array<Record<string, string | number>>;
  } | null>(null);
  const [debug, setDebug] = useState(false);
  const requiredTypes = [
    { id: 'constituents', label: 'Constituents' },
    { id: 'donations', label: 'Donation History' },
    { id: 'emails', label: 'Emails' },
  ] as const;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);

    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);

      if (selectedFiles.length !== 3) {
        setError('Please select exactly 3 CSV files');
        setFiles([]);
        e.target.value = '';
        return;
      }

      setFiles(
        selectedFiles.map((file) => ({
          name: file.name,
          required: true,
          file: file,
        })),
      );
    }
  };

  const handleFileTypeAssignment = (fileIndex: number, type: 'constituents' | 'donations' | 'emails') => {
    setFiles((prevFiles) =>
      prevFiles.map((file, index) =>
        index === fileIndex
          ? { ...file, assignedType: type }
          : file.assignedType === type
          ? { ...file, assignedType: undefined }
          : file,
      ),
    );
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessFiles = async () => {
    const missingTypes = requiredTypes.filter((type) => !files.some((file) => file.assignedType === type.id));

    if (missingTypes.length > 0) {
      alert(`Please assign files for: ${missingTypes.map((t) => t.label).join(', ')}`);
      return;
    }

    try {
      const formData = new FormData();
      files.forEach((file) => {
        if (file.file && file.assignedType) {
          formData.append(file.assignedType, file.file);
        }
      });
      formData.append('debug', debug.toString());

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      downloadCSV(result.data.csvFiles.constituents, 'constituents.csv');
      downloadCSV(result.data.csvFiles.tags, 'tags.csv');

      if (debug) {
        setCsvResult(result.data.debug);
      } else {
        setCsvResult(null);
      }

      setFiles([]);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading files:', error);
      setError('Failed to process files');
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-['Space_Mono'] text-4xl text-gray-900 mb-8">Customer Data Conversion</h1>

        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 mb-8 text-center">
          <input type="file" multiple accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
          <label
            htmlFor="file-upload"
            className="font-['Space_Mono'] inline-block px-6 py-3 bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
          >
            Select CSV Files
          </label>
          <p className="mt-4 text-sm text-gray-600">Please select 3 CSV files and assign their types below</p>
          {error && <p className="mt-4 text-sm text-red-600 font-semibold">{error}</p>}
        </div>

        {files.length > 0 && (
          <div className="font-['Space_Mono']">
            <h2 className="text-xl text-gray-900 mb-4">Assign File Types:</h2>
            <ul className="space-y-4 mb-6">
              {files.map((file, index) => (
                <li key={index} className="p-4 bg-gray-100 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{file.name}</span>
                    <span className="text-sm text-gray-500">{(file.file?.size || 0 / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="flex gap-2">
                    {requiredTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => handleFileTypeAssignment(index, type.id)}
                        className={`px-3 py-1 rounded text-sm ${
                          file.assignedType === type.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                  className="form-checkbox"
                />
                <span className="text-sm text-gray-700">Show Debug Output</span>
              </label>
            </div>

            <button
              className={`w-full font-['Space_Mono'] px-6 py-3 text-white cursor-pointer transition-colors rounded ${
                files.length === 3 &&
                files.every((f) => f.assignedType) &&
                new Set(files.map((f) => f.assignedType)).size === 3
                  ? 'bg-gray-900 hover:bg-gray-800'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={handleProcessFiles}
              disabled={
                !(
                  files.length === 3 &&
                  files.every((f) => f.assignedType) &&
                  new Set(files.map((f) => f.assignedType)).size === 3
                )
              }
            >
              Process Files
            </button>
          </div>
        )}

        {debug && csvResult && (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="text-xl font-['Space_Mono'] text-gray-900 mb-4">Constituents Data</h2>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(csvResult.constituents, null, 2)}
              </pre>
            </div>
            <div>
              <h2 className="text-xl font-['Space_Mono'] text-gray-900 mb-4">Tags Data</h2>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(csvResult.tags, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
