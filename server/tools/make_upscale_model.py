"""
Build server/models/realesr-general-x4v3.onnx from the official Real-ESRGAN
weights, with no PyTorch needed:

    python server/tools/make_upscale_model.py path/to/realesr-general-x4v3.pth

Weights: https://github.com/xinntao/Real-ESRGAN/releases (v0.2.5.0),
Real-ESRGAN (BSD-3-Clause, Xintao Wang et al.).

The network is SRVGGNetCompact (num_feat=64, num_conv=32, PReLU, x4): a
stack of 3x3 convolutions. The ONNX graph holds only Conv + PRelu (supported
by every OpenCV version); the final pixel-shuffle and the nearest-upsampled
input residual are done in numpy by the server.
"""
import collections
import os
import pickle
import struct
import sys
import zipfile

import numpy as np


# ---------------------------------------------------------------- .pth reader

def load_pth(path):
    z = zipfile.ZipFile(path)
    prefix = z.namelist()[0].split("/")[0]
    dtypes = {"FloatStorage": np.float32, "HalfStorage": np.float16, "DoubleStorage": np.float64}

    def rebuild(storage, offset, size, stride, *args):
        arr = np.lib.stride_tricks.as_strided(
            storage[offset:], shape=tuple(size), strides=[s * storage.itemsize for s in stride])
        return np.array(arr, dtype=np.float32)

    class Unpickler(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == "torch._utils" and name == "_rebuild_tensor_v2":
                return rebuild
            if mod == "torch" and name.endswith("Storage"):
                return name
            if mod == "collections" and name == "OrderedDict":
                return collections.OrderedDict
            return super().find_class(mod, name)

        def persistent_load(self, pid):
            _, stype, key, _loc, _numel = pid
            data = z.read(f"{prefix}/data/{key}")
            return np.frombuffer(data, dtype=dtypes[stype])

    state = Unpickler(z.open(f"{prefix}/data.pkl")).load()
    for k in ("params_ema", "params"):
        if isinstance(state, dict) and k in state:
            return state[k]
    return state


# ------------------------------------------------------- minimal ONNX writer

def _varint(n):
    out = bytearray()
    n &= (1 << 64) - 1
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def _key(field, wire):
    return _varint((field << 3) | wire)


def f_varint(field, n):
    return _key(field, 0) + _varint(n)


def f_bytes(field, data):
    if isinstance(data, str):
        data = data.encode()
    return _key(field, 2) + _varint(len(data)) + data


def tensor(name, arr):
    arr = np.ascontiguousarray(arr, dtype=np.float32)
    msg = b"".join(f_varint(1, d) for d in arr.shape)
    msg += f_varint(2, 1)  # FLOAT
    msg += f_bytes(8, name)
    msg += f_bytes(9, arr.tobytes())
    return msg


def attr_ints(name, vals):
    msg = f_bytes(1, name) + f_varint(20, 7)  # INTS
    msg += b"".join(f_varint(8, v) for v in vals)
    return msg


def node(op, inputs, outputs, name, attrs=()):
    msg = b"".join(f_bytes(1, i) for i in inputs)
    msg += b"".join(f_bytes(2, o) for o in outputs)
    msg += f_bytes(3, name) + f_bytes(4, op)
    msg += b"".join(f_bytes(5, a) for a in attrs)
    return msg


def value_info(name, channels):
    dims = [f_bytes(1, f_varint(1, 1)), f_bytes(1, f_varint(1, channels)),
            f_bytes(1, f_bytes(2, "H")), f_bytes(1, f_bytes(2, "W"))]
    shape = b"".join(dims)
    tensor_type = f_varint(1, 1) + f_bytes(2, shape)
    return f_bytes(1, name) + f_bytes(2, f_bytes(1, tensor_type))


def build_onnx(params):
    convs = sorted({int(k.split(".")[1]) for k in params if k.endswith(".bias")})
    nodes, inits = [], []
    x = "input"
    for idx in convs:
        w = params[f"body.{idx}.weight"]
        b = params[f"body.{idx}.bias"]
        wn, bn = f"w{idx}", f"b{idx}"
        out = "output" if idx == convs[-1] else f"c{idx}"
        inits += [tensor(wn, w), tensor(bn, b)]
        nodes.append(node("Conv", [x, wn, bn], [out], f"conv{idx}",
                          [attr_ints("kernel_shape", [3, 3]), attr_ints("pads", [1, 1, 1, 1])]))
        x = out
        slope_key = f"body.{idx + 1}.weight"
        if slope_key in params and idx != convs[-1]:
            s = params[slope_key].reshape(-1, 1, 1)
            sn, out = f"s{idx + 1}", f"p{idx + 1}"
            inits.append(tensor(sn, s))
            nodes.append(node("PRelu", [x, sn], [out], f"prelu{idx + 1}"))
            x = out
    out_ch = params[f"body.{convs[-1]}.weight"].shape[0]
    graph = b"".join(f_bytes(1, n) for n in nodes)
    graph += f_bytes(2, "srvgg")
    graph += b"".join(f_bytes(5, t) for t in inits)
    graph += f_bytes(11, value_info("input", 3))
    graph += f_bytes(12, value_info("output", out_ch))
    opset = f_bytes(1, "") + f_varint(2, 13)
    model = f_varint(1, 7) + f_bytes(2, "filequik") + f_bytes(8, opset) + f_bytes(7, graph)
    return model, len(convs), out_ch


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(__file__), "..", "models", "realesr-general-x4v3.onnx")
    p = load_pth(src)
    model, n, out_ch = build_onnx(p)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(dst, "wb") as fh:
        fh.write(model)
    print(f"wrote {dst}: {n} convs, output channels {out_ch}, {len(model) / 1e6:.1f} MB")
