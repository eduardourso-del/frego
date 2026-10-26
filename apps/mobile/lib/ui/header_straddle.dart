import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../theme/frego_theme.dart';

/// Paints Céu Azul behind the top half of [child], so a card sits on the
/// boundary between the header and the page.
class HeaderStraddle extends SingleChildRenderObjectWidget {
  const HeaderStraddle({
    super.key,
    required this.topGap,
    required this.bottomGap,
    required super.child,
  });

  final double topGap;
  final double bottomGap;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      RenderHeaderStraddle(topGap: topGap, bottomGap: bottomGap);

  @override
  void updateRenderObject(
    BuildContext context,
    RenderHeaderStraddle renderObject,
  ) {
    renderObject
      ..topGap = topGap
      ..bottomGap = bottomGap;
  }
}

class RenderHeaderStraddle extends RenderProxyBox {
  RenderHeaderStraddle({required double topGap, required double bottomGap})
      : _topGap = topGap,
        _bottomGap = bottomGap;

  double _topGap;
  double _bottomGap;

  double get topGap => _topGap;
  set topGap(double value) {
    if (_topGap == value) return;
    _topGap = value;
    markNeedsPaint();
  }

  double get bottomGap => _bottomGap;
  set bottomGap(double value) {
    if (_bottomGap == value) return;
    _bottomGap = value;
    markNeedsPaint();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final cardHeight =
        (size.height - _topGap - _bottomGap).clamp(0.0, size.height);
    final blueHeight = _topGap + cardHeight / 2;
    context.canvas.drawRect(
      offset & Size(size.width, blueHeight),
      Paint()..color = FregoColors.azul,
    );
    super.paint(context, offset);
  }
}
