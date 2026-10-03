import React, { useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
    image: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
    circular?: boolean;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
    image,
    onCropComplete,
    onCancel,
    circular = true,
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropAreaComplete = (_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCrop = async () => {
        if (croppedAreaPixels) {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            if (croppedImage) {
                onCropComplete(croppedImage);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
            <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
                <button
                    onClick={onCancel}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>
                <h2 className="text-white font-medium">Edit Image</h2>
                <button
                    onClick={handleCrop}
                    className="p-2 text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1"
                >
                    <Check className="h-6 w-6" />
                    Done
                </button>
            </div>

            <div className="relative flex-1">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape={circular ? 'round' : 'rect'}
                    showGrid={false}
                    onCropChange={onCropChange}
                    onCropComplete={onCropAreaComplete}
                    onZoomChange={onZoomChange}
                />
            </div>

            <div className="p-6 bg-gray-900">
                <div className="max-w-xs mx-auto">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-3 text-center">
                        Zoom
                    </label>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => onZoomChange(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
